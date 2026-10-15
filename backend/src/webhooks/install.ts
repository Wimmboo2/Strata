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
 * Currently ALWAYS false: no GitHub App exists for this project, so the
 * complete verification flow (App JWT check + verified GitHub identity
 * check in verifyInstallationWithGitHub below) cannot run. Both the setup
 * and callback endpoints fail closed while this returns false.
 */
export function isGithubInstallEnabled(): boolean {
  return false;
}

/**
 * Verify an installation against GitHub. NOT IMPLEMENTED — this is the gate
 * every install link must pass before it is trusted.
 *
 * Four outcomes, and callers must handle each differently:
 * - "verified": the installation belongs to our App AND its account matches
 *   the authenticated GitHub identity of the linking user. Safe to bind.
 * - "rejected": definitive negative (unknown installation, wrong App,
 *   account mismatch). The token stays consumed; the caller fails closed.
 * - "transient": network timeout, DNS failure, or GitHub 5xx — the check
 *   itself could not run. The caller MUST release the token claim so the
 *   same state can be retried; never burn a token on an inconclusive check.
 * - "unavailable": integration not configured. Fail closed, touch nothing.
 *
 * Minimum implementation required to enable the feature (all four parts):
 * 1. App ownership: mint a GitHub App JWT (RS256 with GITHUB_APP_ID and the
 *    App private key, expiry <= 10 minutes; node:crypto only, no new
 *    dependency) and GET https://api.github.com/app/installations/{id}.
 *    Reject unless the response identifies OUR configured App.
 * 2. User-installation association: confirm the authenticated GitHub user is
 *    authorized for that installation using GitHub's documented
 *    authorization flow (GitHub OAuth login for the Strata user, then check
 *    the installation's account against it).
 * 3. Strata authorization: the verified GitHub login must belong to the
 *    Strata profile that minted the setup state. Matching the installation's
 *    account login against the self-asserted profile.github_username field
 *    alone does NOT establish ownership and must never be the check.
 * 4. Replay safety is already handled by the single-use state token; keep it.
 *
 * Private keys must live in environment variables / the Render dashboard,
 * never in source, snapshots, or logs.
 */
export type VerificationOutcome =
  | { status: "verified"; accountLogin: string }
  | { status: "rejected" }
  | { status: "transient" }
  | { status: "unavailable" };

export async function verifyInstallationWithGitHub(
  _installationId: number
): Promise<VerificationOutcome> {
  return { status: "unavailable" };
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
