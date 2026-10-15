const REPO_FULL_NAME_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const GITHUB_SHA_RE = /^[0-9a-f]{5,64}$/i;

/** True only for strings shaped like `owner/repo` with safe characters. */
export function isValidRepoFullName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return REPO_FULL_NAME_RE.test(value.trim().toLowerCase());
}

/** Lowercased canonical form. Only call after isValidRepoFullName. */
export function normalizeRepoFullName(value: string): string {
  return value.trim().toLowerCase();
}

/** True only for plausible git SHAs (prevents path games in constructed URLs). */
export function isValidGithubSha(value: unknown): value is string {
  return typeof value === "string" && GITHUB_SHA_RE.test(value);
}

/**
 * Allowlist-based URL validation using real URL parsing, not prefix checks.
 * Only https://github.com/... links pass. Returns null for anything else,
 * including javascript:, data:, non-GitHub hosts, and unparseable input.
 */
export function safeGithubUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.hostname.toLowerCase() !== "github.com") return null;
  if (!parsed.pathname || parsed.pathname === "/") return null;
  parsed.hash = "";
  return parsed.toString();
}

/** Repository page link, or null when the identifier is not a valid repo name. */
export function repoPageUrl(repoFullName: string): string | null {
  if (!isValidRepoFullName(repoFullName)) return null;
  return "https://github.com/" + normalizeRepoFullName(repoFullName);
}
