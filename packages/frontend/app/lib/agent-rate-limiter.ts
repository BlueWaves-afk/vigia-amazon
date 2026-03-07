/**
 * Client-side rate limiter for agent queries
 * Prevents abuse of AWS credits by limiting query frequency
 */

interface RateLimitConfig {
  maxQueriesPerMinute: number;
  maxQueriesPerHour: number;
  cooldownMs: number;
}

interface QueryRecord {
  timestamp: number;
  endpoint: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxQueriesPerMinute: 5,
  maxQueriesPerHour: 30,
  cooldownMs: 2000, // 2 seconds between queries
};

const STORAGE_KEY = 'vigia_agent_rate_limit';

export class AgentRateLimiter {
  private config: RateLimitConfig;
  private queries: QueryRecord[] = [];
  private lastQueryTime: number = 0;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.queries = data.queries || [];
        this.lastQueryTime = data.lastQueryTime || 0;
        
        // Clean old queries
        this.cleanOldQueries();
      } catch (e) {
        console.error('Failed to load rate limit data:', e);
      }
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        queries: this.queries,
        lastQueryTime: this.lastQueryTime,
      }));
    } catch (e) {
      console.error('Failed to save rate limit data:', e);
    }
  }

  private cleanOldQueries(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Keep only queries from last hour
    this.queries = this.queries.filter(q => q.timestamp > oneHourAgo);
  }

  canQuery(endpoint: string = 'default'): { allowed: boolean; reason?: string; retryAfter?: number } {
    const now = Date.now();
    
    // Check cooldown
    const timeSinceLastQuery = now - this.lastQueryTime;
    if (timeSinceLastQuery < this.config.cooldownMs) {
      return {
        allowed: false,
        reason: 'Please wait between queries',
        retryAfter: this.config.cooldownMs - timeSinceLastQuery,
      };
    }

    this.cleanOldQueries();

    // Check per-minute limit
    const oneMinuteAgo = now - 60 * 1000;
    const queriesLastMinute = this.queries.filter(q => q.timestamp > oneMinuteAgo).length;
    
    if (queriesLastMinute >= this.config.maxQueriesPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit: ${this.config.maxQueriesPerMinute} queries per minute`,
        retryAfter: 60 * 1000,
      };
    }

    // Check per-hour limit
    const queriesLastHour = this.queries.length;
    
    if (queriesLastHour >= this.config.maxQueriesPerHour) {
      return {
        allowed: false,
        reason: `Rate limit: ${this.config.maxQueriesPerHour} queries per hour`,
        retryAfter: 60 * 60 * 1000,
      };
    }

    return { allowed: true };
  }

  recordQuery(endpoint: string = 'default'): void {
    const now = Date.now();
    
    this.queries.push({
      timestamp: now,
      endpoint,
    });
    
    this.lastQueryTime = now;
    this.cleanOldQueries();
    this.saveToStorage();
  }

  getRemainingQueries(): { perMinute: number; perHour: number } {
    this.cleanOldQueries();
    
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const queriesLastMinute = this.queries.filter(q => q.timestamp > oneMinuteAgo).length;
    const queriesLastHour = this.queries.length;

    return {
      perMinute: Math.max(0, this.config.maxQueriesPerMinute - queriesLastMinute),
      perHour: Math.max(0, this.config.maxQueriesPerHour - queriesLastHour),
    };
  }

  reset(): void {
    this.queries = [];
    this.lastQueryTime = 0;
    this.saveToStorage();
  }
}

// Singleton instance
let rateLimiterInstance: AgentRateLimiter | null = null;

export function getAgentRateLimiter(): AgentRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new AgentRateLimiter();
  }
  return rateLimiterInstance;
}
