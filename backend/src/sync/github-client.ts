import { Octokit } from "octokit";

export interface ConditionalResult<T> {
  status: 200 | 304 | 404;
  data: T | null;
  etag: string | null;
}

/**
 * Resolve the GitHub token to use for a request.
 *
 * Precedence:
 * 1. An explicitly supplied token (e.g. a GitHub App installation token).
 * 2. GITHUB_TOKEN from the environment.
 * 3. Nothing — unauthenticated access, which GitHub limits to 60 requests
 *    per hour per originating IP.
 *
 * `explicit` uses `undefined` to mean "no preference, use the environment"
 * and `null` to mean "deliberately anonymous". The difference matters: the
 * anonymous fallback must not silently pick up a token again.
 */
function authToken(explicit?: string | null): string | undefined {
  if (explicit === null) return undefined;
  if (explicit) return explicit;
  return process.env.GITHUB_TOKEN;
}

export function createOctokit(token?: string | null): Octokit {
  const resolved = authToken(token);
  return new Octokit(resolved ? { auth: resolved } : {});
}

export async function conditionalRequest<T>(
  url: string,
  etag: string | null,
  token?: string | null
): Promise<ConditionalResult<T>> {
  const res = await request<T>(url, etag, token);
  // A token scoped to a GitHub App installation only covers the repos that
  // installation can see. For any other public repo the token gets a 404
  // while an anonymous request succeeds, so fall back to anonymous access
  // rather than losing the repo entirely.
  if (res.status === 404 && token) {
    return request<T>(url, etag, null);
  }
  return res;
}

async function request<T>(
  url: string,
  etag: string | null,
  token?: string | null
): Promise<ConditionalResult<T>> {
  const octokit = createOctokit(token);
  const headers: Record<string, string> = {};
  if (etag) headers["If-None-Match"] = etag;
  try {
    const res = await octokit.request(`GET ${url}`, { headers, per_page: 100 });
    const outEtag = (res.headers.etag as string | undefined) ?? null;
    return { status: 200, data: res.data as T, etag: outEtag };
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 304) return { status: 304, data: null, etag };
    if (status === 404) return { status: 404, data: null, etag };
    throw err;
  }
}
