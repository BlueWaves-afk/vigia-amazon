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
  private readonly PRELOADED_PREFIX = 'preloaded_';
  private readonly USER_SESSION_KEY = 'vigia_user_sessions';
  private readonly UNSAVED_SESSION_KEY = 'vigia_unsaved_session';

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

  private isPreloadedSession(sessionId: string): boolean {
    return sessionId.startsWith(this.PRELOADED_PREFIX);
  }

  async createSession(data: SessionData): Promise<SessionFile> {
    const sessionId = `${data.geohash7}#${data.timestamp}`;
    
    // Compute file hash
    const payload = `${sessionId}${data.geohash7}${data.timestamp}${data.hazardCount}${data.verifiedCount}${data.contributorId}`;
    const fileHash = await this.computeHash(payload);

    // Create session object
    const session: SessionFile = {
      ...data,
      userId: this.userId,
      sessionId,
      fileHash,
      parentHash: 'genesis',
    };

    // Store in sessionStorage (unsaved) - will be moved to localStorage on save
    sessionStorage.setItem(this.UNSAVED_SESSION_KEY, JSON.stringify(session));

    return session;
  }

  async saveSession(sessionId: string): Promise<void> {
    // Move from sessionStorage to localStorage
    const unsaved = sessionStorage.getItem(this.UNSAVED_SESSION_KEY);
    if (!unsaved) return;

    const session = JSON.parse(unsaved);
    if (session.sessionId !== sessionId) return;

    // Get existing saved sessions
    const savedSessions = this.getSavedSessions();
    savedSessions.push(session);
    
    // Save to localStorage
    localStorage.setItem(this.USER_SESSION_KEY, JSON.stringify(savedSessions));
    
    // Clear from sessionStorage
    sessionStorage.removeItem(this.UNSAVED_SESSION_KEY);
  }

  private getSavedSessions(): SessionFile[] {
    const saved = localStorage.getItem(this.USER_SESSION_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  async openSession(sessionId: string): Promise<SessionFile> {
    // Check if it's an unsaved session
    const unsaved = sessionStorage.getItem(this.UNSAVED_SESSION_KEY);
    if (unsaved) {
      const session = JSON.parse(unsaved);
      if (session.sessionId === sessionId) return session;
    }

    // Check saved sessions in localStorage
    const savedSessions = this.getSavedSessions();
    const saved = savedSessions.find(s => s.sessionId === sessionId);
    if (saved) return saved;

    // Check if it's a preloaded session
    if (this.isPreloadedSession(sessionId)) {
      // Try cache first
      let session = await this.cache.get(sessionId);
      
      if (!session) {
        // Fetch from API (preloaded sessions only)
        session = await this.apiClient.getSession(sessionId, this.userId);
        await this.cache.put(session);
      }
      
      return session;
    }

    throw new Error('Session not found');
  }

  async listSessions(): Promise<SessionFile[]> {
    // Get preloaded sessions from API
    const preloadedSessions = await this.apiClient.listSessions(this.userId);
    
    // Mark them as preloaded
    preloadedSessions.forEach(s => {
      if (!s.sessionId.startsWith(this.PRELOADED_PREFIX)) {
        s.sessionId = `${this.PRELOADED_PREFIX}${s.sessionId}`;
      }
    });
    
    // Update cache
    for (const session of preloadedSessions) {
      await this.cache.put(session);
    }

    // Get user-created sessions from localStorage
    const savedSessions = this.getSavedSessions();

    // Get unsaved session from sessionStorage
    const unsaved = sessionStorage.getItem(this.UNSAVED_SESSION_KEY);
    const unsavedSession = unsaved ? [JSON.parse(unsaved)] : [];

    return [...preloadedSessions, ...savedSessions, ...unsavedSession];
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Only allow deleting user-created sessions
    if (this.isPreloadedSession(sessionId)) {
      throw new Error('Cannot delete preloaded sessions');
    }

    // Remove from localStorage
    const savedSessions = this.getSavedSessions();
    const filtered = savedSessions.filter(s => s.sessionId !== sessionId);
    localStorage.setItem(this.USER_SESSION_KEY, JSON.stringify(filtered));

    // Remove from sessionStorage if it's the unsaved one
    const unsaved = sessionStorage.getItem(this.UNSAVED_SESSION_KEY);
    if (unsaved) {
      const session = JSON.parse(unsaved);
      if (session.sessionId === sessionId) {
        sessionStorage.removeItem(this.UNSAVED_SESSION_KEY);
      }
    }

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
