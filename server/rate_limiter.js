"use strict";

function requestIdentity(req) {
  const apiToken = req.get("X-API-Key") || req.query.api_key || "no-key";
  const forwarded = req.get("X-Forwarded-For");
  const ip = (forwarded ? forwarded.split(",")[0] : req.ip) || "unknown";
  return `${ip}|${apiToken}`;
}

function normalizeInt(value, fallback, min) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
}

function createRateLimitMiddleware(options = {}) {
  const state = options.state instanceof Map ? options.state : new Map();
  const nowFn = typeof options.now === "function" ? options.now : () => Date.now();
  const windowMs = normalizeInt(options.windowMs, 60000, 5000);
  const max = normalizeInt(options.max, 240, 30);
  const skipPaths = new Set(Array.isArray(options.skipPaths) ? options.skipPaths.map((item) => String(item || "")) : []);

  function middleware(req, res, next) {
    if (skipPaths.has(String(req.path || ""))) {
      return next();
    }

    const key = requestIdentity(req);
    const now = nowFn();
    const existing = state.get(key);
    if (!existing || existing.resetAt <= now) {
      state.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      res.setHeader("Retry-After", String(Math.ceil((existing.resetAt - now) / 1000)));
      return res.status(429).json({ status: "error", error: "rate limit exceeded" });
    }

    existing.count += 1;
    return next();
  }

  middleware.prune = (cutoffAgeMs) => {
    const age = normalizeInt(cutoffAgeMs, Math.max(5 * 60 * 1000, windowMs * 2), 1000);
    const cutoff = nowFn() - age;
    let removed = 0;
    for (const [key, entry] of state.entries()) {
      if (Number(entry.resetAt) < cutoff) {
        state.delete(key);
        removed += 1;
      }
    }
    return removed;
  };

  middleware.state = state;
  middleware.windowMs = windowMs;
  middleware.max = max;
  return middleware;
}

module.exports = {
  requestIdentity,
  createRateLimitMiddleware,
};
