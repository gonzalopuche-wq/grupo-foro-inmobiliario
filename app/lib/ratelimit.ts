/**
 * Simple in-process rate limiter for Next.js API routes.
 * State is per-instance — good enough for single-region Vercel deployments
 * and far better than no rate limiting at all.
 *
 * For distributed environments, replace with @upstash/ratelimit + Redis.
 */

interface Window { count: number; resetAt: number; }

const store = new Map<string, Window>();

// Evict stale entries every 5 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of store) {
    if (w.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param identifier  unique key (e.g. "ip:127.0.0.1" or "user:uuid")
 * @param limit       max requests per window
 * @param windowMs    window duration in milliseconds
 */
export function rateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || entry.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

/** Extract a best-effort IP from a Next.js request */
export function getIp(req: Request): string {
  const headers = (req as any).headers;
  return (
    headers.get?.("x-real-ip") ||
    headers.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
