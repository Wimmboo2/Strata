import { listAppInstallations, mintInstallationToken, type AppInstallation } from "../lib/github-app";

/**
 * GitHub credentials for the server-side sync.
 *
 * Why this exists: the browser used to talk to api.github.com directly, so
 * every sync burned the 60 requests/hour anonymous budget of the user's own
 * IP. Server-side we can authenticate as a GitHub App installation, which
 * raises that to 5,000 requests/hour (see GitHub's rate limit docs).
 *
 * Safety rule, applied everywhere below: we only ever ingest PUBLIC repos.
 * An installation token can read private repositories of the account it
 * belongs to, so every repo is checked for `private: false` before its
 * activity is fetched and stored. A repo that is private (or that we cannot
 * confirm) is skipped, never synced.
 */

const INSTALLATION_LIST_TTL_MS = 5 * 60 * 1000;
const INSTALLATION_TOKEN_TTL_MS = 50 * 60 * 1000;
const VISIBILITY_TTL_MS = 30 * 60 * 1000;

let installationCache: { at: number; list: AppInstallation[] } | null = null;
const installationTokens = new Map<number, { token: string; at: number }>();
const visibilityCache = new Map<string, { visibility: "public" | "private"; at: number }>();

async function getInstallations(): Promise<AppInstallation[]> {
  const now = Date.now();
  if (installationCache && now - installationCache.at < INSTALLATION_LIST_TTL_MS) {
    return installationCache.list;
  }
  const list = await listAppInstallations();
  installationCache = { at: now, list };
  return list;
}

/**
 * Best available token for reading repositories owned by `owner`.
 *
 * 1. A GitHub App installation token for our App on that account (5,000/hr).
 * 2. GITHUB_TOKEN from the environment (5,000/hr, owner-scoped).
 * 3. Nothing — unauthenticated access (60/hr per IP).
 */
export async function tokenForOwner(owner: string): Promise<string | null> {
  const lower = owner.toLowerCase();
  try {
    const installations = await getInstallations();
    const match = installations.find((i) => i.account_login.toLowerCase() === lower);
    if (match) {
      const cached = installationTokens.get(match.id);
      const now = Date.now();
      if (cached && now - cached.at < INSTALLATION_TOKEN_TTL_MS) {
        return cached.token;
      }
      const token = await mintInstallationToken(match.id);
      if (token) {
        installationTokens.set(match.id, { token, at: now });
        return token;
      }
    }
  } catch {
    // Fall through to the environment token / anonymous access.
  }
  return process.env.GITHUB_TOKEN ?? null;
}

/**
 * Decide whether a repository is public and therefore safe to ingest.
 *
 * "unknown" is returned when GitHub would not answer (rate limited, network
 * trouble). Unknown repos are skipped by the caller: storing data we could
 * not prove to be public is exactly what we must not do.
 */
export async function repoVisibility(
  owner: string,
  name: string,
  token: string | null
): Promise<"public" | "private" | "unknown"> {
  const key = owner.toLowerCase() + "/" + name.toLowerCase();
  const cached = visibilityCache.get(key);
  if (cached && Date.now() - cached.at < VISIBILITY_TTL_MS) return cached.visibility;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "strata"
  };
  if (token) headers.Authorization = "Bearer " + token;

  let res: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      res = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "unknown";
  }

  if (res.status === 404) {
    // With a token, a 404 can mean "not covered by this installation" rather
    // than "private". Retry anonymously: if the repo is publicly visible we
    // may sync it, otherwise it stays out.
    if (token) {
      const anon = await fetchPublicRepo(owner, name);
      if (anon === "public") {
        visibilityCache.set(key, { visibility: "public", at: Date.now() });
        return "public";
      }
      if (anon === "private") {
        visibilityCache.set(key, { visibility: "private", at: Date.now() });
        return "private";
      }
      return "unknown";
    }
    visibilityCache.set(key, { visibility: "private", at: Date.now() });
    return "private";
  }
  if (res.status === 403 || res.status === 429) return "unknown";
  if (!res.ok) return "unknown";

  let body: unknown;
  try {
    body = (await res.json()) as unknown;
  } catch {
    return "unknown";
  }
  const isPrivate = (body as { private?: unknown })?.private;
  if (isPrivate === true) {
    visibilityCache.set(key, { visibility: "private", at: Date.now() });
    return "private";
  }
  if (isPrivate === false) {
    visibilityCache.set(key, { visibility: "public", at: Date.now() });
    return "public";
  }
  return "unknown";
}

/**
 * Look a repo up with no credentials at all.
 *
 * An unauthenticated request can only ever see a public repository, so a
 * 404 here means "not public" and a 200 with private=false means "public".
 */
async function fetchPublicRepo(owner: string, name: string): Promise<"public" | "private" | "unknown"> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "strata"
  };
  let res: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      // Deliberately no Authorization header: this lookup must see only what
      // an anonymous visitor could see.
      res = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "unknown";
  }
  if (res.status === 404) return "private";
  if (res.status === 403 || res.status === 429) return "unknown";
  if (!res.ok) return "unknown";
  try {
    const body = (await res.json()) as { private?: unknown };
    if (body?.private === false) return "public";
    if (body?.private === true) return "private";
    return "unknown";
  } catch {
    return "unknown";
  }
}
