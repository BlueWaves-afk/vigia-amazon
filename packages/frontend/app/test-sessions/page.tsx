'use client';

import { useState, useEffect } from 'react';
import { VFSManager } from '../lib/vfs-manager';

export default function SessionTestPage() {
  const [vfsManager, setVfsManager] = useState<VFSManager | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      try {
        const apiUrl = 'https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod';
        const manager = new VFSManager(apiUrl);
        await manager.init();
        setVfsManager(manager);
        setStatus('Ready');
      } catch (err) {
        setError((err as Error).message);
        setStatus('Error');
      }
    };
    init();
  }, []);

  const createTestSession = async () => {
    if (!vfsManager) return;
    
    try {
      setStatus('Creating session...');
      const session = await vfsManager.createSession({
        userId: 'default',
        geohash7: '9q8yy4k',
        timestamp: new Date().toISOString(),
        hazardCount: 5,
        verifiedCount: 3,
        contributorId: 'test-user',
        status: 'draft',
        location: {
          continent: 'Asia',
          country: 'India',
          region: 'Odisha',
          city: 'Rourkela',
        },
        hazards: [
          { type: 'POTHOLE', lat: 22.2604, lon: 84.8536, confidence: 0.85 },
          { type: 'POTHOLE', lat: 22.2605, lon: 84.8537, confidence: 0.92 },
        ],
        metadata: { source: 'test' },
      });
      
      setStatus(`Session created: ${session.sessionId}`);
      await loadSessions();
    } catch (err) {
      setError((err as Error).message);
      setStatus('Error creating session');
    }
  };

  const loadSessions = async () => {
    if (!vfsManager) return;
    
    try {
      setStatus('Loading sessions...');
      const list = await vfsManager.listSessions();
      setSessions(list);
      setStatus(`Loaded ${list.length} sessions`);
    } catch (err) {
      setError((err as Error).message);
      setStatus('Error loading sessions');
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!vfsManager) return;
    
    try {
      setStatus(`Deleting ${sessionId}...`);
      await vfsManager.deleteSession(sessionId);
      setStatus('Session deleted');
      await loadSessions();
    } catch (err) {
      setError((err as Error).message);
      setStatus('Error deleting session');
    }
  };

  return (
    <div className="min-h-screen bg-ide-bg p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-ide-text">Session Management Test</h1>
        
        {/* Status */}
        <div className="bg-ide-panel border border-ide-border p-4 rounded">
          <div className="text-sm font-data">
            <div className="text-ide-text">Status: {status}</div>
            {error && <div className="text-red-500 mt-2">Error: {error}</div>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={createTestSession}
            disabled={!vfsManager}
            className="px-4 py-2 text-sm bg-ide-panel border border-ide-border text-ide-text hover:bg-ide-hover disabled:opacity-50"
          >
            Create Test Session
          </button>
          <button
            onClick={loadSessions}
            disabled={!vfsManager}
            className="px-4 py-2 text-sm bg-ide-panel border border-ide-border text-ide-text hover:bg-ide-hover disabled:opacity-50"
          >
            Load Sessions
          </button>
        </div>

        {/* Sessions List */}
        <div className="bg-ide-panel border border-ide-border p-4 rounded">
          <h2 className="text-sm font-semibold text-ide-text mb-4">Sessions ({sessions.length})</h2>
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className="bg-ide-bg border border-ide-border p-3 rounded flex justify-between items-start"
              >
                <div className="font-data text-xs space-y-1">
                  <div className="text-ide-text font-semibold">{session.sessionId}</div>
                  <div className="text-ide-text-secondary">
                    Geohash: {session.geohash7} | Hazards: {session.hazardCount} | Status: {session.status}
                  </div>
                  <div className="text-ide-text-tertiary">
                    {session.location?.city}, {session.location?.region}, {session.location?.country}
                  </div>
                  <div className="text-ide-text-tertiary">
                    Hash: {session.fileHash?.slice(0, 16)}... | Parent: {session.parentHash?.slice(0, 16)}...
                  </div>
                </div>
                <button
                  onClick={() => deleteSession(session.sessionId)}
                  className="px-2 py-1 text-xs bg-red-500 text-white hover:bg-red-600 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-ide-text-secondary text-sm text-center py-4">
                No sessions yet. Create one to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
