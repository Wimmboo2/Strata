import crypto from "node:crypto";

export function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Short-lived GitHub App JWT (RS256, 10 minute expiry, 60s clock skew
 * allowance). node:crypto only, no extra dependency.
 *
 * The App private key must come from the environment (Render dashboard),
 * never from source, logs, or snapshots.
 */
export function mintAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID ?? "";
  // Tolerate escaped newlines in case the key was pasted with literal \n.
  // A real PEM body is base64, which never contains a backslash, so this
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

export interface AppInstallation {
  id: number;
  account_login: string;
  repository_selection: "all" | "selected";
}

/** List the installations of our GitHub App. Empty array when unavailable. */
export async function listAppInstallations(): Promise<AppInstallation[]> {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return [];
  let jwt: string;
  try {
    jwt = mintAppJwt();
  } catch {
    return [];
  }
  try {
    const res = await fetch("https://api.github.com/app/installations?per_page=100", {
      headers: {
        Authorization: "Bearer " + jwt,
        Accept: "application/vnd.github+json",
        "User-Agent": "strata-app"
      }
    });
    if (!res.ok) return [];
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) return [];
    const rows = body as Record<string, unknown>[];
    const out: AppInstallation[] = [];
    for (const row of rows) {
      const id = Number(row.id);
      const login = (row.account as { login?: unknown } | undefined)?.login;
      if (!Number.isInteger(id) || typeof login !== "string" || !login) continue;
      const selection = row.repository_selection === "all" ? "all" : "selected";
      out.push({ id, account_login: login, repository_selection: selection });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Mint a short-lived installation access token for an installation id.
 * Returns null when it cannot be minted (no credentials, unknown id,
 * network trouble). Callers fall back to unauthenticated requests.
 */
export async function mintInstallationToken(installationId: number): Promise<string | null> {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return null;
  let jwt: string;
  try {
    jwt = mintAppJwt();
  } catch {
    return null;
  }
  try {
    const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + jwt,
        Accept: "application/vnd.github+json",
        "User-Agent": "strata-app"
      }
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: unknown };
    return typeof body.token === "string" && body.token ? body.token : null;
  } catch {
    return null;
  }
}
