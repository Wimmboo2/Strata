import crypto from "node:crypto";

/**
 * Constant-time secret comparison. Rejects empty inputs outright so that a
 * missing expected secret can never compare equal to a missing supplied one.
 */
export function secretsEqual(provided: string | undefined | null, expected: string | undefined | null): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
