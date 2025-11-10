// Rate limiter with optional Redis backing. If REDIS_URL is provided, it
// uses Redis to provide global limits across instances; otherwise falls
// back to the previous in-memory Map implementation (suitable for single
// instance deployments).

import type RedisType from 'ioredis';

let redis: RedisType | null = null;
if (process.env.REDIS_URL) {
  // Lazy import to avoid requiring ioredis in environments where it's not used
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const IORedis = require('ioredis');
  redis = new IORedis(process.env.REDIS_URL);
}

const attempts = new Map<string, { fails: number; first: number; lockUntil?: number }>();

function now() { return Date.now(); }

function getConfig() {
  const MAX_FAILS = parseInt(process.env.RL_MAX_FAILS || '5', 10); // attempts
  const WINDOW_MS = parseInt(process.env.RL_WINDOW_MS || String(10 * 60 * 1000), 10); // 10 min
  const LOCK_MS = parseInt(process.env.RL_LOCK_MS || String(15 * 60 * 1000), 10); // 15 min
  return { MAX_FAILS, WINDOW_MS, LOCK_MS };
}

export async function rateLimitCheck(key: string) {
  const cfg = getConfig();
  if (redis) {
    // Redis-based check uses a key that stores lockUntil timestamp
    const lockKey = `rl:${key}:lock`;
    const lockUntil = await redis.get(lockKey);
    if (lockUntil) {
      const t = now();
      const until = parseInt(lockUntil, 10);
      if (t < until) return { locked: true, retryAfterMs: until - t } as const;
    }
    return { locked: false } as const;
  }

  const entry = attempts.get(key);
  const t = now();
  if (!entry) return { locked: false } as const;
  if (entry.lockUntil && t < entry.lockUntil) {
    return { locked: true, retryAfterMs: entry.lockUntil - t } as const;
  }
  // Reset window if expired
  const { WINDOW_MS } = cfg;
  if (t - entry.first > WINDOW_MS) {
    attempts.delete(key);
  }
  return { locked: false } as const;
}

export async function rateLimitFail(key: string) {
  const t = now();
  const cfg = getConfig();
  if (redis) {
    // Use Redis INCR with TTL to count fails in window, and set lock key when threshold reached
    const countKey = `rl:${key}:count`;
    const lockKey = `rl:${key}:lock`;
    const cnt = await redis.incr(countKey);
    if (cnt === 1) {
      await redis.pexpire(countKey, cfg.WINDOW_MS);
    }
    if (cnt >= cfg.MAX_FAILS) {
      const until = t + cfg.LOCK_MS;
      await redis.set(lockKey, String(until), 'PX', cfg.LOCK_MS);
      await redis.del(countKey);
      return { locked: true, retryAfterMs: cfg.LOCK_MS } as const;
    }
    return { locked: false } as const;
  }

  const entry = attempts.get(key);
  if (!entry) {
    attempts.set(key, { fails: 1, first: t });
    return { locked: false } as const;
  }
  // Reset window if expired
  if (t - entry.first > cfg.WINDOW_MS) {
    entry.fails = 0;
    entry.first = t;
    entry.lockUntil = undefined;
  }
  entry.fails += 1;
  if (entry.fails >= cfg.MAX_FAILS) {
    entry.lockUntil = t + cfg.LOCK_MS;
    entry.fails = 0;
    entry.first = t;
    return { locked: true, retryAfterMs: cfg.LOCK_MS } as const;
  }
  return { locked: false } as const;
}

export async function rateLimitSuccess(key: string) {
  if (redis) {
    const countKey = `rl:${key}:count`;
    await redis.del(countKey);
    return;
  }
  attempts.delete(key);
}
