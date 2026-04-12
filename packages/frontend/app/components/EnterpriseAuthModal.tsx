'use client';

import { useState } from 'react';

const MONO = 'var(--v-font-mono)';
const SANS = 'var(--v-font-ui)';

const ENTERPRISE_API = process.env.NEXT_PUBLIC_ENTERPRISE_API_URL ?? '';

interface EnterpriseSession {
  userId: string; email: string; apiKey: string;
  trialVga: number; dataCredits: number; idToken: string;
}

const SESSION_KEY = 'vigia:enterprise:session';

export function loadSession(): EnterpriseSession | null {
  try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function saveSession(s: EnterpriseSession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

type Mode = 'register' | 'login';

export function EnterpriseAuthModal({ onAuth }: { onAuth: (session: EnterpriseSession) => void }) {
  const [mode, setMode]       = useState<Mode>('login');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${ENTERPRISE_API}/enterprise/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Request failed'); return; }

      // For register, auto-login after
      if (mode === 'register') {
        const loginRes = await fetch(`${ENTERPRISE_API}/enterprise/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) { setError(loginData.error || 'Auto-login failed'); return; }
        const session: EnterpriseSession = { ...loginData };
        saveSession(session);
        onAuth(session);
      } else {
        const session: EnterpriseSession = { ...data };
        saveSession(session);
        onAuth(session);
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(6px)', background: 'color-mix(in srgb, var(--c-bg) 60%, transparent)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: 'var(--c-panel)', border: '1px solid var(--v-border-default)', borderRadius: 14, padding: '28px 32px', width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: SANS, color: 'var(--c-text)', marginBottom: 4 }}>
            {mode === 'login' ? 'Enterprise Sign In' : 'Create Enterprise Account'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--c-text-3)', fontFamily: SANS }}>
            {mode === 'login' ? 'Access your DaaS dashboard' : 'Start your free 20 VGA trial'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['email', 'password'] as const).map(field => (
            <div key={field}>
              <label style={{ fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{field}</label>
              <input
                type={field === 'password' ? 'password' : 'email'}
                value={field === 'email' ? email : password}
                onChange={e => field === 'email' ? setEmail(e.target.value) : setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder={field === 'email' ? 'you@company.com' : '••••••••'}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--c-elevated)', border: '1px solid var(--v-border-default)', borderRadius: 7, padding: '8px 12px', color: 'var(--c-text)', fontFamily: MONO, fontSize: '0.72rem', outline: 'none' }}
              />
            </div>
          ))}
        </div>

        {error && <div style={{ fontSize: '0.62rem', color: '#ef4444', fontFamily: MONO, lineHeight: 1.5 }}>{error}</div>}

        <button
          onClick={submit} disabled={loading}
          style={{ padding: '10px 0', borderRadius: 8, border: 'none', background: loading ? '#4f46e5aa' : '#6366f1', color: '#fff', fontFamily: MONO, fontSize: '0.7rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
        </button>

        <button
          onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.62rem', fontFamily: MONO, color: 'var(--c-text-3)', textDecoration: 'underline' }}
        >
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
