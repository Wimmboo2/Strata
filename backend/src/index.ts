import "dotenv/config";
import express from "express";
import { loadConfig } from "./lib/config";
import { verifyGithubSignature } from "./webhooks/github";
import { handleInstallation, handleIssues, handlePullRequest, handlePush, recordInstallation } from "./webhooks/handlers";
import { runPoll } from "./sync/poll";

const config = loadConfig();
const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post(
  "/webhooks/github",
  express.raw({ type: "*/*", limit: "1mb" }),
  async (req, res) => {
    const signature = req.header("X-Hub-Signature-256") ?? undefined;
    const raw = req.body as Buffer;
    if (!verifyGithubSignature(raw, signature, process.env.GITHUB_WEBHOOK_SECRET ?? "")) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }
    const event = req.header("X-GitHub-Event") ?? "";
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      res.status(400).json({ error: "invalid json" });
      return;
    }
    try {
      if (event === "push") await handlePush(payload as never);
      else if (event === "pull_request") await handlePullRequest(payload as never);
      else if (event === "issues") await handleIssues(payload as never);
      else if (event === "installation" || event === "installation_repositories") {
        await handleInstallation(payload as never);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("webhook handler failed", err);
      res.status(500).json({ error: "handler failed" });
    }
  }
);

app.get("/github/install/callback", async (req, res) => {
  const installationId = Number(req.query.installation_id);
  const state = String(req.query.state ?? "");
  if (!installationId || !state) {
    res.status(400).json({ error: "missing installation_id or state" });
    return;
  }
  try {
    await recordInstallation(installationId, "pending", state);
    res.json({ ok: true, installation_id: installationId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "install link failed" });
  }
});

app.post("/sync/trigger", async (req, res) => {
  const secret = req.header("X-Cron-Secret");
  if (!process.env.SYNC_CRON_SECRET || secret !== process.env.SYNC_CRON_SECRET) {
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
});

app.listen(config.port, () => {
  console.log(`backend listening on ${config.port}`);
});
