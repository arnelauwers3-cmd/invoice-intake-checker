import "server-only";

// Simple fixed-window rate limiter, kept in memory per server instance.
// Good enough to stop casual abuse of the free Gemini quota on a public demo;
// on Vercel each instance has its own window, so the real limit is a bit looser.

const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterS: number } {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return { ok: true, retryAfterS: 0 };
  }
  if (w.count >= limit) {
    return { ok: false, retryAfterS: Math.ceil((w.start + windowMs - now) / 1000) };
  }
  w.count++;
  return { ok: true, retryAfterS: 0 };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
