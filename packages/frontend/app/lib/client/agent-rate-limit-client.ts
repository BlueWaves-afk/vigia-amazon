'use client';

import { useEffect, useMemo, useState } from 'react';

const LOCK_KEY = 'vigia:agent:lockUntilMs';
const LOCK_EVENT = 'vigia-agent-lock';

const USAGE_KEY = 'vigia_agent_usage';
const MAX_PER_MINUTE = 5;
const MAX_PER_HOUR = 30;

type UsageData = {
  requests: number[];
  hourlyRequests: number[];
};

export class AgentRateLimitedError extends Error {
  public readonly lockUntilMs: number;
  public readonly retryAfterMs: number;

  constructor(message: string, lockUntilMs: number, retryAfterMs: number) {
    super(message);
    this.name = 'AgentRateLimitedError';
    this.lockUntilMs = lockUntilMs;
    this.retryAfterMs = retryAfterMs;
  }
}

function safeParseInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function readLockUntilMs(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function readUsage(now = Date.now()): UsageData {
  if (typeof window === 'undefined') return { requests: [], hourlyRequests: [] };
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<UsageData>) : undefined;
    const oneMinuteAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;
    const requests = Array.isArray(parsed?.requests)
      ? parsed.requests.filter((t) => typeof t === 'number' && t > oneMinuteAgo)
      : [];
    const hourlyRequests = Array.isArray(parsed?.hourlyRequests)
      ? parsed.hourlyRequests.filter((t) => typeof t === 'number' && t > oneHourAgo)
      : [];
    return { requests, hourlyRequests };
  } catch {
    return { requests: [], hourlyRequests: [] };
  }
}

function writeUsage(data: UsageData) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function computeClientLockUntilMs(now: number, usage: UsageData): number {
  let lockUntilMs = 0;
  if (usage.requests.length >= MAX_PER_MINUTE) {
    const oldest = Math.min(...usage.requests);
    lockUntilMs = Math.max(lockUntilMs, oldest + 60_000);
  }
  if (usage.hourlyRequests.length >= MAX_PER_HOUR) {
    const oldest = Math.min(...usage.hourlyRequests);
    lockUntilMs = Math.max(lockUntilMs, oldest + 3_600_000);
  }
  // Ensure non-past if we computed anything.
  return lockUntilMs > 0 ? Math.max(lockUntilMs, now) : 0;
}

export function setAgentLockUntilMs(lockUntilMs: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCK_KEY, String(lockUntilMs));
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent(LOCK_EVENT, {
      detail: { lockUntilMs },
    })
  );
}

export function clearAgentLock() {
  setAgentLockUntilMs(0);
}

export function getAgentLockState(nowMs = Date.now()) {
  const lockUntilMs = readLockUntilMs();
  const isLocked = nowMs < lockUntilMs;
  const secondsRemaining = isLocked
    ? Math.max(1, Math.ceil((lockUntilMs - nowMs) / 1000))
    : 0;
  return { lockUntilMs, isLocked, secondsRemaining };
}

function lockFromRetryAfterSeconds(seconds: number) {
  const now = Date.now();
  const retryAfterMs = Math.max(0, seconds * 1000);
  const lockUntilMs = now + retryAfterMs;
  setAgentLockUntilMs(lockUntilMs);
  return { lockUntilMs, retryAfterMs };
}

export function applyRateLimitFromResponse(res: Response) {
  if (res.status !== 429) return;

  // RFC 9110: Retry-After is either HTTP-date or delay-seconds.
  // Our server sends delay-seconds.
  const retryAfterSeconds = safeParseInt(res.headers.get('Retry-After'));
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    lockFromRetryAfterSeconds(retryAfterSeconds);
    return;
  }

  // Fallback: short lock if header missing.
  lockFromRetryAfterSeconds(10);
}

export async function agentFetch(input: RequestInfo | URL, init?: RequestInit) {
  const now = Date.now();
  const lockState = getAgentLockState(now);
  if (lockState.isLocked) {
    throw new AgentRateLimitedError(
      `Rate limited — try again in ${lockState.secondsRemaining}s`,
      lockState.lockUntilMs,
      Math.max(0, lockState.lockUntilMs - now)
    );
  }

  // Proactive client-side lock (prevents the 6th request from even hitting the network).
  const usage = readUsage(now);
  const clientLockUntilMs = computeClientLockUntilMs(now, usage);
  if (clientLockUntilMs > now) {
    setAgentLockUntilMs(clientLockUntilMs);
    const secondsRemaining = Math.max(1, Math.ceil((clientLockUntilMs - now) / 1000));
    throw new AgentRateLimitedError(
      `Rate limited — try again in ${secondsRemaining}s`,
      clientLockUntilMs,
      clientLockUntilMs - now
    );
  }

  // Record this attempt so the next call can be blocked before the server responds.
  const nextUsage: UsageData = {
    requests: [...usage.requests, now],
    hourlyRequests: [...usage.hourlyRequests, now],
  };
  writeUsage(nextUsage);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vigia-agent-query'));
  }

  const res = await fetch(input, init);
  if (res.status === 429) applyRateLimitFromResponse(res);
  return res;
}

export function useAgentRateLimitLock() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lockUntilMs, setLockUntilMs] = useState(() => readLockUntilMs());

  const state = useMemo(() => {
    const isLocked = nowMs < lockUntilMs;
    const secondsRemaining = isLocked
      ? Math.max(1, Math.ceil((lockUntilMs - nowMs) / 1000))
      : 0;
    return { lockUntilMs, isLocked, secondsRemaining };
  }, [nowMs, lockUntilMs]);

  useEffect(() => {
    const onLock = (e: Event) => {
      const anyEvent = e as CustomEvent<{ lockUntilMs?: number }>;
      const next = anyEvent?.detail?.lockUntilMs;
      if (typeof next === 'number') setLockUntilMs(next);
      else setLockUntilMs(readLockUntilMs());
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== LOCK_KEY) return;
      setLockUntilMs(readLockUntilMs());
    };

    window.addEventListener(LOCK_EVENT, onLock);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LOCK_EVENT, onLock);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!state.isLocked) return;
    const interval = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state.isLocked]);

  // Keep "now" fresh even when not locked (for instant transitions).
  useEffect(() => {
    if (state.isLocked) return;
    const t = setTimeout(() => setNowMs(Date.now()), 250);
    return () => clearTimeout(t);
  }, [state.isLocked, lockUntilMs]);

  return state;
}
