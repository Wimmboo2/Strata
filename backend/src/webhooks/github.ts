import crypto from "node:crypto";

export function verifyGithubSignature(rawBody: unknown, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !Buffer.isBuffer(rawBody)) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
