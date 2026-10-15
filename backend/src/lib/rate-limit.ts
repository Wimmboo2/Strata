import type { NextFunction, Request, Response } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10000;

/**
 * Client IP via Express req.ip under the single trusted proxy hop
 * configured in index.ts. An attacker cannot make this return an address
 * of their choosing: with exactly one trusted hop, entries they inject to
 * the left of the chain are never consulted. What is NOT guaranteed without
 * runtime header observation is per-client precision — if more than one
 * upstream proxy appends to X-Forwarded-For, req.ip resolves to a shared
 * egress address and unrelated clients share one budget. That failure mode
 * is over-blocking, never bypass.
 */
export function clientIp(req: Request): string {
  return req.ip || "unknown";
}

function sweep(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  // Probabilistic cleanup keeps memory bounded without a timer.
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size < MAX_BUCKETS / 2) break;
  }
}

/**
 * Minimal in-process fixed-window rate limiter. No dependencies.
 * `key` customizes grouping (e.g. per-user); defaults to per-IP.
 */
export function rateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const bucketKey = opts.key ? opts.key(req) : clientIp(req);
    let bucket = buckets.get(bucketKey);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    sweep(now);
    if (bucket.count > opts.max) {
      res.status(429).json({ error: "rate limited" });
      return;
    }
    next();
  };
}
