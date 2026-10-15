import crypto from "node:crypto";
import { getAdminClient } from "../lib/supabase-admin";

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_RE = /^[0-9a-f]{64}$/i;

export function isValidSetupState(value: unknown): value is string {
  return typeof value === "string" && STATE_RE.test(value);
}

/**
 * Whether the GitHub installation flow may operate at all.
 *
 * True only when App credentials are configured (GITHUB_APP_ID plus
 * GITHUB_APP_PRIVATE_KEY). The callback additionally requires
 * verifyInstallationWithGitHub to pass, so credentials alone never
 * authorize a binding on their own.
 */
export function isGithubInstallEnabled(): boolean {
  return Boolean(process.env.GITHUB_APP_ID) && Boolean(process.env.GITHUB_APP_PRIVATE_KEY);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Short-lived App JWT for GitHub API authentication (node:crypto only). */
function mintAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID ?? "";
  // Tolerate escaped newlines in case the key was pasted with \n literals;
  // a real PEM body is base64, which never contains a backslash, so this
  // replacement cannot corrupt a valid key.
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!appId || !privateKey) throw new Error("github app credentials missing");
  const now = Math.floor(Date.now() / 1000);
  const data =
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    base64url(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  return data + "." + base64url(signer.sign(privateKey));
}

/**
 * Verify an installation belongs to OUR GitHub App. This is the gate every
 * install link must pass before it is trusted.
 *
 * Four outcomes, and callers must handle each differently:
 * - "verified": the installation belongs to our App. Safe to bind, with
 *   the caveat below: this alone does NOT prove the Strata user owns the
 *   GitHub account (see deferred identity step).
 * - "rejected": definitive negative (unknown installation, wrong App).
 *   The token stays consumed; the caller fails closed.
 * - "transient": network timeout, DNS failure, GitHub 5xx, or broken local
 *   credentials — the check itself could not run. The caller MUST release
 *   the token claim so the same state can be retried; never burn a token
 *   on an inconclusive check.
 * - "unavailable": integration not configured. Fail closed, touch nothing.
 *
 * Deferred until a GitHub OAuth login flow exists: binding the verified
 * installation account to the Strata user's *verified* GitHub identity.
 * Matching against the self-asserted profile.github_username field alone
 * does NOT establish ownership and must never be the check. Until then, a
 * signed-in Strata user could bind someone else's still-unbound
 * installation of our App to their own profile; impact is limited
 * (activity data is public, existing bindings cannot be stolen, webhooks
 * and sync never consult this table), but do not present a binding as
 * proof of GitHub account ownership.
 *
 * Private keys must live in environment variables / the Render dashboard,
 * never in source, snapshots, or logs.
 */
export type VerificationOutcome =
  | { status: "verified"; accountLogin: string }
  | { status: "rejected" }
  | { status: "transient" }
  | { status: "unavailable" };

/**
 * Verify an installation belongs to OUR GitHub App.
 *
 * Implemented: App-membership check (step 1 of the enablement spec).
 * Still deferred: verified GitHub-identity binding (steps 2-3, needs a
 * GitHub OAuth login flow). Until that lands, a binding proves the
 * installation is genuinely ours — never that the Strata user owns the
 * GitHub account — and existing bindings still cannot be stolen
 * (first-writer-wins). See the residual risk note in the module docs.
 */
export async function verifyInstallationWithGitHub(
  installationId: number
): Promise<VerificationOutcome> {
  const appId = process.env.GITHUB_APP_ID ?? "";
  if (!appId || !process.env.GITHUB_APP_PRIVATE_KEY) return { status: "unavailable" };
  let jwt: string;
  try {
    jwt = mintAppJwt();
  } catch {
    // Local credential problem (e.g. malformed key): retrying cannot help
    // until it is fixed, but burning the user's token for our config error
    // would be wrong, so report transient and let the caller release it.
    return { status: "transient" };
  }
  let res: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "strata-app"
        },
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { status: "transient" };
  }
  if (res.status === 404) return { status: "rejected" };
  if (res.status === 401 || res.status === 403 || res.status >= 500) return { status: "transient" };
  if (!res.ok) return { status: "rejected" };
  let body: unknown;
  try {
    body = (await res.json()) as unknown;
  } catch {
    return { status: "transient" };
  }
  const record = body as { app_id?: unknown; account?: { login?: unknown } };
  if (Number(record?.app_id) !== Number(appId)) return { status: "rejected" };
  const login = record?.account?.login;
  if (typeof login !== "string" || !login) return { status: "rejected" };
  return { status: "verified", accountLogin: login };
}

/**
 * Mint a single-use setup token bound to a profile. The caller must already
 * be authenticated (their Supabase user id is the profile id); the token is
 * what the browser redirect later presents, exactly like OAuth `state`.
 */
export async function mintSetupState(profileId: string): Promise<{ state: string; expiresAt: string }> {
  const supabase = getAdminClient();
  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
  const { error } = await supabase
    .from("install_states")
    .insert({ token: state, profile_id: profileId, expires_at: expiresAt });
  if (error) throw error;
  return { state, expiresAt };
}

export type ConfirmResult =
  | { ok: true; already: boolean }
  | { ok: false; reason: "invalid_state" | "forbidden" | "unverified" | "retryable" };

/**
 * Bind an installation to the profile that minted the setup state.
 * Security properties:
 * - The owner always comes from the consumed token, never from a client
 *   parameter, so a caller cannot claim another profile's installation.
 * - Token consumption is a single atomic UPDATE gated on unused+unexpired,
 *   so concurrent or replayed callbacks yield exactly one winner.
 * - GitHub-side verification runs before any binding is created or
 *   trusted, so nothing is linked on the strength of an integer id, a
 *   state token, or a self-asserted username alone. While
 *   verifyInstallationWithGitHub is unimplemented this always fails
 *   closed with "unverified".
 * - A transient verification failure releases the claim (resetting used_at
 *   only where it still holds our own timestamp, so we can never clobber
 *   another winner's claim) instead of burning the token: the same state
 *   retries cleanly. Definitive rejections leave the token consumed, so one
 *   token cannot be reused to probe many installation ids.
 * - First writer wins on installation_id (plain INSERT, PK conflict handled
 *   explicitly), so an existing binding can never be stolen, even in a race.
 */
export async function confirmInstallationLink(opts: {
  installationId: number;
  state: string;
}): Promise<ConfirmResult> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { data: consumed, error: consumeError } = await supabase
    .from("install_states")
    .update({ used_at: now })
    .eq("token", opts.state)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("profile_id");
  if (consumeError) throw consumeError;

  let profileId: string | null = null;
  if (consumed && consumed.length > 0) {
    profileId = consumed[0].profile_id as string;
  } else {
    // Unknown, expired, or already-used token. If it was already used by this
    // same flow and the binding exists, fall through to the verification
    // gate below so a refresh is judged by the same rules, not by a shortcut.
    const { data: tokenRow } = await supabase
      .from("install_states")
      .select("profile_id,used_at")
      .eq("token", opts.state)
      .single();
    if (!tokenRow?.used_at) return { ok: false, reason: "invalid_state" };
    const { data: bound } = await supabase
      .from("github_installations")
      .select("owner_profile_id")
      .eq("installation_id", opts.installationId)
      .single();
    if (!bound || bound.owner_profile_id !== tokenRow.profile_id) {
      return { ok: false, reason: "invalid_state" };
    }
    profileId = tokenRow.profile_id as string;
  }

  const verification = await verifyInstallationWithGitHub(opts.installationId);
  if (verification.status === "transient") {
    // The check itself could not run: release our claim so the same state
    // retries cleanly. Gated on our own timestamp — the atomic consume above
    // admitted exactly one winner, so only we could have set this value.
    await supabase
      .from("install_states")
      .update({ used_at: null })
      .eq("token", opts.state)
      .eq("used_at", now);
    return { ok: false, reason: "retryable" };
  }
  if (verification.status !== "verified") {
    // Definitive rejection, or the integration is not configured: leave the
    // token consumed (strict single-use) and fail closed.
    return { ok: false, reason: "unverified" };
  }

  const { error: insertError } = await supabase.from("github_installations").insert({
    installation_id: opts.installationId,
    github_account_login: verification.accountLogin,
    owner_profile_id: profileId
  });
  if (!insertError) return { ok: true, already: false };
  if (insertError.code !== "23505") throw insertError;

  const { data: existing } = await supabase
    .from("github_installations")
    .select("owner_profile_id")
    .eq("installation_id", opts.installationId)
    .single();
  if (existing && existing.owner_profile_id === profileId) {
    await supabase
      .from("github_installations")
      .update({ github_account_login: verification.accountLogin })
      .eq("installation_id", opts.installationId)
      .eq("owner_profile_id", profileId);
    return { ok: true, already: true };
  }
  return { ok: false, reason: "forbidden" };
}
