// API Client for Session Management
export class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async createSession(session: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    if (!response.ok) throw new Error(`Failed to create session: ${response.statusText}`);
    return response.json();
  }

  async getSession(sessionId: string, userId: string = 'default'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}?userId=${userId}`);
    if (!response.ok) throw new Error(`Failed to get session: ${response.statusText}`);
    return response.json();
  }

  async listSessions(userId: string = 'default'): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/sessions?userId=${userId}`);
    if (!response.ok) throw new Error(`Failed to list sessions: ${response.statusText}`);
    const data = await response.json();
    return data.sessions || [];
  }

  async updateSession(sessionId: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Failed to update session: ${response.statusText}`);
    return response.json();
  }

  async deleteSession(sessionId: string, userId: string = 'default'): Promise<void> {
    const encodedSessionId = encodeURIComponent(sessionId);
    const response = await fetch(`${this.baseUrl}/sessions/${encodedSessionId}?userId=${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('Delete failed:', error);
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
  }

  async validateSession(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) throw new Error(`Failed to validate session: ${response.statusText}`);
    return response.json();
  }

  async resolveGeohash(geohash7: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/geohash/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geohash7 }),
    });
    if (!response.ok) throw new Error(`Failed to resolve geohash: ${response.statusText}`);
    return response.json();
  }

  async submitTelemetry(telemetry: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telemetry),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('Telemetry submission failed:', error);
      throw new Error(`Failed to submit telemetry: ${response.statusText}`);
    }
    return response.json();
  }
}
