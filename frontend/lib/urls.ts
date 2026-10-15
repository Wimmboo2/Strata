const REPO_FULL_NAME_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

/** True only for strings shaped like `owner/repo` with safe characters. */
export function isValidRepoFullName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return REPO_FULL_NAME_RE.test(value.trim().toLowerCase());
}

/**
 * Allowlist-based URL validation using real URL parsing. Only
 * https://github.com/... links pass. Returns null for unsafe schemes
 * (javascript:, data:, ...), non-GitHub hosts, and unparseable input.
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
  return "https://github.com/" + repoFullName.trim().toLowerCase();
}
