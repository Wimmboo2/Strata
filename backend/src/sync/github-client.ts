import { Octokit } from "octokit";

export interface ConditionalResult<T> {
  status: 200 | 304;
  data: T | null;
  etag: string | null;
}

function authToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

export function createOctokit(): Octokit {
  const token = authToken();
  return new Octokit(token ? { auth: token } : {});
}

export async function conditionalRequest<T>(url: string, etag: string | null): Promise<ConditionalResult<T>> {
  const octokit = createOctokit();
  const headers: Record<string, string> = {};
  if (etag) headers["If-None-Match"] = etag;
  try {
    const res = await octokit.request(`GET ${url}`, { headers, per_page: 100 });
    const outEtag = (res.headers.etag as string | undefined) ?? null;
    return { status: 200, data: res.data as T, etag: outEtag };
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 304) return { status: 304, data: null, etag };
    throw err;
  }
}
