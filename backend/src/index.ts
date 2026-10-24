import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import { loadConfig } from "./lib/config";
import { secretsEqual } from "./lib/secrets";
import { rateLimit } from "./lib/rate-limit";
import { verifyGithubSignature } from "./webhooks/github";
import { claimDelivery, completeDelivery } from "./webhooks/dedupe";
import { handleInstallation, handleIssues, handlePullRequest, handlePush } from "./webhooks/handlers";
import { confirmInstallationLink, isGithubInstallEnabled, isValidSetupState, mintSetupState } from "./webhooks/install";
import { getAdminClient } from "./lib/supabase-admin";
import { runPoll } from "./sync/poll";
import { getJob, startUserSync } from "./sync/user-sync";
import { resolveUserId } from "./lib/auth";

const config = loadConfig();
// Fail closed: without a real webhook secret the server would accept forged
// signatures computed with an empty key, so refuse to boot instead.
if (!config.GITHUB_WEBHOOK_SECRET) {
  throw new Error("Refusing to start: GITHUB_WEBHOOK_SECRET is missing or too short");
}
const WEBHOOK_SECRET: string = config.GITHUB_WEBHOOK_SECRET;

const app = express();
app.disable("x-powered-by");
// Render serves traffic through its edge (Cloudflare) and load balancer
// before it reaches this process, i.e. one trusted proxy hop as seen by the
// app. Trust exactly that hop so req.ip resolves to the address the proxy
// chain vouches for. Do NOT use `true` (trusts attacker-supplied headers at
// any distance). Re-verify the hop count if the hosting setup ever changes:
// too few trusts everyone into one bucket, too many re-opens spoofing.
app.set("trust proxy", 1);

// Express 4 does not catch errors thrown from async handlers, which can crash
// the process on modern Node. Wrap every async route so failures always
// become 500 responses handled below instead of unhandled rejections.
function asyncHandler(fn: (req: express.Request, res: express.Response) => Promise<void>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

// Per-IP limits keyed by req.ip (see trust proxy above). This is safe
// against spoofing — no attacker input reaches the key — but it is not
// guaranteed per-client precision: depending on how many upstream proxies
// append to X-Forwarded-For, req.ip may resolve to a shared egress address
// and unrelated clients may share one budget (fail-safe: limits trigger
// early, never bypassed). No new dependencies: see lib/rate-limit.ts.
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120 });
const syncLimiter = rateLimit({ windowMs: 60_000, max: 5 });
const installLimiter = rateLimit({ windowMs: 60_000, max: 30 });
// Setup is authenticated, so scope its budget per caller token instead of IP.
const setupLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  key: (req) => "setup:" + crypto.createHash("sha256").update(req.header("authorization") ?? "none").digest("hex")
});
// User-triggered sync: budget per caller token (not IP), so one noisy
// client cannot spend everyone's allowance.
const syncRunLimiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  key: (req) => "syncrun:" + crypto.createHash("sha256").update(req.header("authorization") ?? "none").digest("hex")
});
// Status polling is frequent but cheap; allow a generous per-token budget.
const syncStatusLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  key: (req) => "syncstatus:" + crypto.createHash("sha256").update(req.header("authorization") ?? "none").digest("hex")
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post(
  "/webhooks/github",
  webhookLimiter,
  express.raw({ type: "*/*", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    // Delivery IDs make redeliveries idempotent (see webhooks/dedupe.ts).
    // Unknown events (e.g. ping) are acknowledged without work.
    const deliveryId = req.header("X-GitHub-Delivery") ?? "";
    const event = req.header("X-GitHub-Event") ?? "";
    if (!verifyGithubSignature(req.body, req.header("X-Hub-Signature-256") ?? undefined, WEBHOOK_SECRET)) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }
    let payload: unknown;
    try {
      if (!Buffer.isBuffer(req.body)) throw new Error("missing body");
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      res.status(400).json({ error: "invalid json" });
      return;
    }
    if (deliveryId) {
      try {
        if (!(await claimDelivery(deliveryId))) {
          res.json({ ok: true, deduped: true });
          return;
        }
      } catch (err) {
        console.error("delivery claim failed", err);
        res.status(500).json({ error: "handler failed" });
        return;
      }
    }
    try {
      if (event === "push") await handlePush(payload as never);
      else if (event === "pull_request") await handlePullRequest(payload as never);
      else if (event === "issues") await handleIssues(payload as never);
      else if (event === "installation" || event === "installation_repositories") {
        await handleInstallation(payload as never);
      }
      if (deliveryId) await completeDelivery(deliveryId, true);
      res.json({ ok: true });
    } catch (err) {
      console.error("webhook handler failed", err);
      // Mark failed so a GitHub redelivery retries instead of being skipped.
      if (deliveryId) await completeDelivery(deliveryId, false);
      res.status(500).json({ error: "handler failed" });
    }
  })
);

// Mint a single-use install-setup token. Caller must be signed in; the token
// is bound to their profile and is the only thing the callback trusts.
// Fail closed while the GitHub verification flow is not configured.
app.post(
  "/github/install/setup",
  setupLimiter,
  asyncHandler(async (req, res) => {
    if (!isGithubInstallEnabled()) {
      res.status(503).json({ error: "github integration not configured" });
      return;
    }
    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.getUser(
      (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "")
    );
    if (error || !data.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { state, expiresAt } = await mintSetupState(data.user.id);
    res.json({ ok: true, state, expires_at: expiresAt });
  })
);

// GitHub redirects the user's browser here after App installation.
// Authentication comes from the single-use `state` token minted above:
// it is unpredictable, bound to one profile, expiring, and consumed
// atomically, so it cannot be replayed or used for another profile.
// The link is additionally gated on GitHub-side verification, so until
// that flow is configured this endpoint always fails closed.
app.get(
  "/github/install/callback",
  installLimiter,
  asyncHandler(async (req, res) => {
    const installationId = Number(req.query.installation_id);
    const state = String(req.query.state ?? "");
    const setupAction = String(req.query.setup_action ?? "");
    if (!Number.isInteger(installationId) || installationId <= 0 || !isValidSetupState(state)) {
      res.status(400).json({ error: "invalid parameters" });
      return;
    }
    if (setupAction !== "" && setupAction !== "install") {
      res.status(400).json({ error: "unsupported setup action" });
      return;
    }
    // The binding itself is created by confirmInstallationLink with
    // first-writer-wins semantics: an existing binding to another profile
    // can never be stolen, even under concurrent callbacks. "unverified"
    // means GitHub-side confirmation is unavailable: fail closed.
    const result = await confirmInstallationLink({ installationId, state });
    if (!result.ok) {
      // "retryable" means the GitHub check itself failed transiently and the
      // state token was released, so the same callback may be retried.
      if (result.reason === "retryable") {
        res.set("Retry-After", "30");
        res.status(503).json({ error: result.reason });
        return;
      }
      const status = result.reason === "forbidden" ? 403 : result.reason === "unverified" ? 503 : 400;
      res.status(status).json({ error: result.reason });
      return;
    }
    res.json({ ok: true, installation_id: installationId, already: result.already });
  })
);

app.post(
  "/sync/trigger",
  syncLimiter,
  asyncHandler(async (req, res) => {
    if (!secretsEqual(req.header("X-Cron-Secret") ?? undefined, process.env.SYNC_CRON_SECRET ?? undefined)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      await runPoll();
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "sync failed" });
    }
  })
);

// Start a sync for the caller's own repos.
//
// The browser used to do this itself, which meant every sync spent the
// 60 requests/hour anonymous GitHub budget of the user's IP. Running it here
// lets the backend authenticate as a GitHub App installation instead.
//
// The work happens in the background and the client polls /sync/status:
// a cold Render instance needs ~1 minute to wake, and a proxy will not
// hold a request open that long.
app.post(
  "/sync/run",
  syncRunLimiter,
  express.json({ limit: "16kb" }),
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = (req.body ?? {}) as { repo_ids?: unknown };
    let repoIds: string[] | null = null;
    if (Array.isArray(body.repo_ids)) {
      // Only well-formed ids are accepted; the backend still intersects them
      // with the repos the caller actually owns.
      repoIds = body.repo_ids.filter((v): v is string => typeof v === "string" && v.length <= 64).slice(0, 50);
    }
    const job = startUserSync(userId, repoIds);
    // Per-user state: never let a cache hold on to it.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.status(202).json({ ok: true, job_id: job.id, state: job.state });
  })
);

// Poll the state of a sync job started by /sync/run.
app.get(
  "/sync/status",
  syncStatusLimiter,
  asyncHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const jobId = String(req.query.job_id ?? "");
    const job = getJob(jobId);
    // A job belonging to somebody else is reported as unknown, never leaked.
    if (!job || job.userId !== userId) {
      res.status(404).json({ error: "unknown job" });
      return;
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      ok: true,
      job_id: job.id,
      state: job.state,
      repos: job.repos,
      synced: job.synced,
      skipped: job.skipped,
      error: job.error
    });
  })
);

// Last stop for anything asyncHandler catches. Never leaks internals.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  console.error("unhandled backend error", err);
  if (res.headersSent) return;
  // A malformed JSON body is the client's mistake, not ours: answer 400
  // instead of a blanket 500 so the caller can tell the two apart.
  const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
  if (status === 400) {
    res.status(400).json({ error: "invalid request" });
    return;
  }
  res.status(500).json({ error: "internal error" });
});

app.listen(config.port, () => {
  console.log(`backend listening on ${config.port}`);
});
