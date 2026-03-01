import { APIClient } from './api-client';
import { IndexedDBCache } from './indexeddb-cache';

export interface SessionData {
  userId: string;
  geohash7: string;
  timestamp: string;
  hazardCount: number;
  verifiedCount: number;
  contributorId: string;
  status: 'draft' | 'finalized' | 'archived';
  location?: {
    continent?: string;
    country?: string;
    region?: string;
    city?: string;
  };
  hazards: any[];
  metadata?: any;
}

export interface SessionFile extends SessionData {
  sessionId: string;
  fileHash: string;
  parentHash: string;
}

export class VFSManager {
  private apiClient: APIClient;
  private cache: IndexedDBCache;
  private userId: string;

  constructor(apiUrl: string, userId: string = 'default') {
    this.apiClient = new APIClient(apiUrl);
    this.cache = new IndexedDBCache();
    this.userId = userId;
  }

  async init(): Promise<void> {
    await this.cache.init();
  }

  private async computeHash(data: string): Promise<string> {
    // Browser-compatible hash (using SubtleCrypto)
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async createSession(data: SessionData): Promise<SessionFile> {
    const sessionId = `${data.geohash7}#${data.timestamp}`;
    
    // Compute file hash
    const payload = `${sessionId}${data.geohash7}${data.timestamp}${data.hazardCount}${data.verifiedCount}${data.contributorId}`;
    const fileHash = await this.computeHash(payload);

    // Create session object
    const session: any = {
      ...data,
      userId: this.userId,
      sessionId,
      fileHash,
      parentHash: 'genesis', // Will be computed by backend
    };

    // Write to API
    const created = await this.apiClient.createSession(session);

    // Cache locally
    await this.cache.put(created);

    return created;
  }

  async openSession(sessionId: string): Promise<SessionFile> {
    // Try cache first
    let session = await this.cache.get(sessionId);
    
    if (!session) {
      // Fetch from API
      session = await this.apiClient.getSession(sessionId, this.userId);
      // Cache it
      await this.cache.put(session);
    }

    return session;
  }

  async listSessions(): Promise<SessionFile[]> {
    // Fetch from API
    const sessions = await this.apiClient.listSessions(this.userId);
    
    // Update cache
    for (const session of sessions) {
      await this.cache.put(session);
    }

    return sessions;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.apiClient.deleteSession(sessionId, this.userId);
    await this.cache.delete(sessionId);
  }

  async searchSessions(query: { geohash?: string; status?: string }): Promise<SessionFile[]> {
    const allSessions = await this.listSessions();
    
    return allSessions.filter(session => {
      if (query.geohash && !session.geohash7.startsWith(query.geohash)) return false;
      if (query.status && session.status !== query.status) return false;
      return true;
    });
  }
}
