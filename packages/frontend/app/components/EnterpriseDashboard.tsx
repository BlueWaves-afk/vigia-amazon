'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Flame, Activity, Database, Copy, Check, Zap, LogOut } from 'lucide-react';
import { EnterpriseAuthModal, loadSession, saveSession, clearSession } from './EnterpriseAuthModal';

const MONO = 'var(--v-font-mono)';
const SANS = 'var(--v-font-ui)';
const AMOY_SCAN = 'https://amoy.polygonscan.com/tx/';
const ENTERPRISE_API = process.env.NEXT_PUBLIC_ENTERPRISE_API_URL ?? '';

interface BurnRecord { date: string; vga: number; credits: number; tx: string; }
interface Session { userId: string; email: string; apiKey: string; trialVga: number; dataCredits: number; idToken: string; }
interface NodeReward { nodeId: string; contributions: number; sharePct: string; pendingRewardVga: string; pendingRewardUsd: string; }
interface Stats {
  totalSupplyVga: number; totalBurnedVga: number; dbBurnedVga: number; supplyRemainingPct: string;
  vgaPriceUsd: number; priceImpactPerVga: number; priceGenesisUsd: number; bondingCurveFormula: string;
  nodeRewardPoolVga: number; nodeRewardPoolUsd: string; nodeRewards: NodeReward[];
  totalContributions: number; activeNodes: number;
  totalDataCreditsProvisioned: number; totalEnterpriseUsers: number;
  tokenomics: { vgaToUsd: number; creditsPerVga: number; nodeRewardBps: number; initialSupply: number; trialVgaPerAccount: number; trialUsdValue: number; };
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ used, total }: { used: number; total: number }) {
  const r = 36, cx = 44, cy = 44, stroke = 8;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  return (
    <svg width={88} height={88} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--v-border-subtle)" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#6366f1" strokeWidth={stroke}
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={cx} y={cy - 5} textAnchor="middle" fill="var(--c-text)" fontSize={11} fontWeight={700} fontFamily={MONO}>
        {Math.round(pct * 100)}%
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="var(--c-text-3)" fontSize={7} fontFamily={MONO}>used</text>
    </svg>
  );
}

// ── Supply progress bar ───────────────────────────────────────────────────────
function SupplyBar({ burned, total }: { burned: number; total: number }) {
  const pct = Math.min((burned / total) * 100, 100);
  return (
    <div style={{ marginTop: 6, height: 4, borderRadius: 999, background: 'var(--v-border-subtle)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#f97316,#ef4444)', borderRadius: 999, transition: 'width 0.8s ease' }} />
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, accent, bar }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: string; bar?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--c-panel)', border: '1px solid var(--v-border-default)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ color: accent ?? 'var(--c-text-3)', opacity: 0.8 }}>{icon}</span>
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: MONO, color: accent ?? 'var(--c-text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.58rem', color: 'var(--c-text-3)', fontFamily: MONO, marginTop: 3 }}>{sub}</div>
      {bar}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function EnterpriseDashboard() {
  const [session,       setSession]       = useState<Session | null>(null);
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [trialVga,      setTrialVga]      = useState(0);
  const [dataCredits,   setDataCredits]   = useState(0);
  const [burnAmount,    setBurnAmount]    = useState(5);
  const [burnStatus,    setBurnStatus]    = useState<'idle' | 'provisioning' | 'done'>('idle');
  const [burnHistory,   setBurnHistory]   = useState<BurnRecord[]>([]);
  const [copied,        setCopied]        = useState(false);
  const [creditsUsed]                     = useState(2450); // from real API usage tracking (Phase 2)

  // Restore session from localStorage on mount
  useEffect(() => {
    const s = loadSession();
    if (s) { setSession(s); setTrialVga(s.trialVga); setDataCredits(s.dataCredits); }
  }, []);

  // Fetch live stats (chain + DB)
  const refreshStats = useCallback(async () => {
    if (!ENTERPRISE_API) return;
    try {
      const res = await fetch(`${ENTERPRISE_API}/enterprise/stats`);
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  // Fetch fresh user state
  const refreshMe = useCallback(async (s: Session) => {
    if (!ENTERPRISE_API) return;
    try {
      const res = await fetch(`${ENTERPRISE_API}/enterprise/me`, {
        headers: { Authorization: `Bearer ${s.idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrialVga(data.trialVga);
        setDataCredits(data.dataCredits);
        saveSession({ ...s, trialVga: data.trialVga, dataCredits: data.dataCredits });
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshStats();
    const id = setInterval(refreshStats, 30000);
    return () => clearInterval(id);
  }, [refreshStats]);

  useEffect(() => { if (session) refreshMe(session); }, [session, refreshMe]);

  const handleAuth = (s: Session) => {
    setSession(s); setTrialVga(s.trialVga); setDataCredits(s.dataCredits);
    refreshStats();
  };

  const handleCopyKey = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.apiKey).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const handleBurn = async () => {
    if (!session || burnAmount <= 0 || burnAmount > trialVga || burnStatus === 'provisioning') return;
    setBurnStatus('provisioning');
    try {
      const res = await fetch(`${ENTERPRISE_API}/enterprise/burn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.idToken}` },
        body: JSON.stringify({ vgaAmount: burnAmount }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Burn failed'); setBurnStatus('idle'); return; }

      setTrialVga(data.trialVga);
      setDataCredits(data.dataCredits);
      saveSession({ ...session, trialVga: data.trialVga, dataCredits: data.dataCredits });
      setBurnHistory(h => [{
        date: new Date(data.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        vga: burnAmount, credits: data.creditsProvisioned, tx: data.txHash,
      }, ...h]);
      setBurnStatus('done');
      refreshStats(); // refresh pool after burn
      setTimeout(() => setBurnStatus('idle'), 2000);
    } catch (e: any) {
      alert(e.message || 'Network error');
      setBurnStatus('idle');
    }
  };

  const clampBurn = (val: number) => Math.max(1, Math.min(val, trialVga));

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (!session) return <EnterpriseAuthModal onAuth={handleAuth} />;

  // Derive display values from real stats (fall back to 0 while loading)
  const t = stats?.tokenomics;
  const vgaToUsd      = t?.vgaToUsd ?? 1;
  const creditsPerVga = t?.creditsPerVga ?? 1000;
  const initialSupply = t?.initialSupply ?? 1_000_000;
  const totalSupply   = stats?.totalSupplyVga ?? initialSupply;
  const totalBurned   = stats?.totalBurnedVga ?? 0;
  const rewardPool    = stats?.nodeRewardPoolVga ?? 0;
  const activeNodes   = stats?.activeNodes ?? 0;
  const apiKeyDisplay = session.apiKey.slice(0, 14) + '••••';
  const trialUsdValue = trialVga * vgaToUsd;
  // Price impact of this burn (bonding curve: each VGA burned raises price slightly)
  const burnPriceImpact = burnAmount * (stats?.priceImpactPerVga ?? 0);
  const priceAfterBurn  = vgaToUsd + burnPriceImpact;

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--c-bg)', padding: '0 14px 24px' }}>

      {/* ── Header ── */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--v-border-subtle)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.65rem', fontFamily: MONO, color: 'var(--c-text-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enterprise</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb,#22c55e 15%,transparent)', color: '#22c55e', fontSize: '0.58rem', fontFamily: MONO, fontWeight: 700 }}>
            ● Trial: Active
          </span>
          <span style={{ fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>{session.email}</span>
          {/* Live bonding curve price */}
          {stats && (
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb,#6366f1 12%,transparent)', border: '1px solid color-mix(in srgb,#6366f1 30%,transparent)', fontSize: '0.58rem', fontFamily: MONO, color: '#6366f1', fontWeight: 700 }}
              title={`Bonding curve: P = $${stats.priceGenesisUsd} × (${initialSupply.toLocaleString()} ÷ ${totalSupply.toLocaleString()})`}>
              VGA ${vgaToUsd.toFixed(6)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* API Key */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--c-panel)', border: '1px solid var(--v-border-default)', borderRadius: 6, padding: '4px 10px' }}>
            <span style={{ fontSize: '0.6rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>API Key:</span>
            <span style={{ fontSize: '0.6rem', fontFamily: MONO, color: 'var(--c-text-2)' }}>{apiKeyDisplay}</span>
            <button onClick={handleCopyKey} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', padding: 0 }}>
              {copied ? <Check size={11} color="#22c55e" /> : <Copy size={11} />}
            </button>
          </div>
          {/* Logout */}
          <button onClick={() => { clearSession(); setSession(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', padding: 2 }} title="Sign out">
            <LogOut size={13} />
          </button>
        </div>
      </div>

      {/* ── Top metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <MetricCard
          icon={<Database size={13} />} label="Total Global Supply"
          value={`${totalSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })} VGA`}
          sub={`${stats?.supplyRemainingPct ?? '—'}% remaining · $${(totalSupply * vgaToUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })} USD`}
          bar={<SupplyBar burned={totalBurned} total={initialSupply} />}
        />
        <MetricCard
          icon={<Flame size={13} />} label="Total Network Burn"
          value={`${totalBurned.toLocaleString(undefined, { maximumFractionDigits: 4 })} VGA`}
          sub={`$${(totalBurned * vgaToUsd).toFixed(2)} USD removed · 1 VGA = $${vgaToUsd.toFixed(2)}`}
          accent="#f97316"
        />
        <MetricCard
          icon={<Activity size={13} />} label="Live Edge Nodes"
          value={String(activeNodes)}
          sub={`${stats?.totalContributions ?? 0} verified contributions · $${(rewardPool * vgaToUsd).toFixed(2)} reward pool`}
          accent="#6366f1"
        />
      </div>

      {/* ── Middle split ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>

        {/* Left: Acquire API Capacity */}
        <div style={{ background: 'var(--c-panel)', border: '1px solid var(--v-border-default)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={14} color="#f97316" />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, fontFamily: SANS, color: 'var(--c-text)' }}>Acquire API Capacity</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>Balance: <strong style={{ color: 'var(--c-text-2)' }}>{trialVga} VGA</strong></span>
            <span style={{ fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>≈ <strong style={{ color: '#22c55e' }}>${trialUsdValue.toFixed(2)}</strong></span>
          </div>
          </div>

          {/* Rate */}
          <div style={{ background: 'var(--c-elevated)', borderRadius: 6, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>Exchange Rate</span>
            <span style={{ fontSize: '0.62rem', fontFamily: MONO, fontWeight: 700, color: 'var(--c-text)' }}>1 VGA = {creditsPerVga.toLocaleString()} Credits = ${vgaToUsd.toFixed(2)} USD</span>
          </div>

          {/* Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Burn Amount</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min={1} max={trialVga} value={burnAmount}
                  onChange={e => setBurnAmount(clampBurn(parseInt(e.target.value) || 1))}
                  style={{ width: 52, background: 'var(--c-elevated)', border: '1px solid var(--v-border-default)', borderRadius: 5, padding: '3px 7px', color: 'var(--c-text)', fontFamily: MONO, fontSize: '0.72rem', textAlign: 'center', outline: 'none' }}
                />
                <span style={{ fontSize: '0.6rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>VGA</span>
              </div>
            </div>
            <input
              type="range" min={1} max={trialVga} value={burnAmount}
              onChange={e => setBurnAmount(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6366f1' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.56rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>
              <span>1 VGA</span><span>{trialVga} VGA</span>
            </div>
          </div>

          {/* Preview */}
          <div style={{ background: 'color-mix(in srgb,#6366f1 8%,var(--c-elevated))', border: '1px solid color-mix(in srgb,#6366f1 25%,transparent)', borderRadius: 7, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>Burn {burnAmount} VGA (${(burnAmount * vgaToUsd).toFixed(2)}) →</span>
              <span style={{ fontSize: '0.78rem', fontFamily: MONO, fontWeight: 700, color: '#6366f1' }}>{(burnAmount * creditsPerVga).toLocaleString()} Credits</span>
            </div>
            <div style={{ fontSize: '0.56rem', fontFamily: MONO, color: 'var(--c-text-3)', marginTop: 4 }}>
              {(burnAmount * (stats?.tokenomics.nodeRewardBps ?? 0.2)).toFixed(2)} VGA → node reward pool
            </div>
            {stats && (
              <div style={{ fontSize: '0.56rem', fontFamily: MONO, marginTop: 4, display: 'flex', gap: 12 }}>
                <span style={{ color: 'var(--c-text-3)' }}>Price now: <strong style={{ color: 'var(--c-text-2)' }}>${vgaToUsd.toFixed(6)}</strong></span>
                <span style={{ color: '#22c55e' }}>After burn: <strong>${priceAfterBurn.toFixed(6)}</strong> (+${burnPriceImpact.toFixed(8)})</span>
              </div>
            )}
          </div>

          {trialVga === 0 && (
            <div style={{ fontSize: '0.6rem', fontFamily: MONO, color: '#f97316', lineHeight: 1.5 }}>
              Trial accounts are limited to 20 VGA. Please contact sales to upgrade your SLA.
            </div>
          )}

          <button
            onClick={handleBurn}
            disabled={burnAmount <= 0 || burnAmount > trialVga || burnStatus === 'provisioning'}
            style={{
              padding: '10px 0', borderRadius: 7, border: 'none', cursor: burnStatus === 'provisioning' ? 'not-allowed' : 'pointer',
              background: burnStatus === 'provisioning' ? '#4f46e5aa' : burnStatus === 'done' ? '#22c55e' : '#6366f1',
              color: '#fff', fontFamily: MONO, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
              transition: 'background 0.2s',
            }}
          >
            {burnStatus === 'provisioning' ? '⏳ Provisioning on-chain…' : burnStatus === 'done' ? '✓ Credits Provisioned' : '🔥 Burn & Provision Credits'}
          </button>
        </div>

        {/* Right: API Usage */}
        <div style={{ background: 'var(--c-panel)', border: '1px solid var(--v-border-default)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} color="#6366f1" />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, fontFamily: SANS, color: 'var(--c-text)' }}>API Usage & Quotas</span>
          </div>

          {/* Donut + numbers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DonutChart used={creditsUsed} total={dataCredits || 1} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: MONO, color: 'var(--c-text)', lineHeight: 1 }}>{creditsUsed.toLocaleString()}</div>
              <div style={{ fontSize: '0.6rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>of {dataCredits.toLocaleString()} credits used</div>
              <div style={{ fontSize: '0.6rem', fontFamily: MONO, color: '#22c55e', marginTop: 2 }}>{Math.max(0, dataCredits - creditsUsed).toLocaleString()} remaining</div>
            </div>
          </div>

          {/* Endpoint stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--v-border-subtle)', borderRadius: 7, overflow: 'hidden' }}>
            {[
              { endpoint: '/v1/hazards/live',  calls: '1,842', latency: '94ms' },
              { endpoint: '/v1/routes/safe',   calls: '608',   latency: '312ms' },
            ].map((row, i) => (
              <div key={row.endpoint} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '9px 12px', background: i % 2 === 0 ? 'var(--c-elevated)' : 'transparent', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: '#6366f1' }}>{row.endpoint}</span>
                <span style={{ fontSize: '0.6rem', fontFamily: MONO, color: 'var(--c-text-2)' }}>{row.calls} calls</span>
                <span style={{ fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>p50 {row.latency}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
            1 Data Credit = 1 API call · Credits never expire
          </div>
        </div>
      </div>

      {/* ── Node Reward Pool ── */}
      {stats && stats.nodeRewards.length > 0 && (
        <div style={{ background: 'var(--c-panel)', border: '1px solid var(--v-border-default)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--v-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={13} color="#6366f1" />
            <span style={{ fontSize: '0.62rem', fontWeight: 700, fontFamily: MONO, color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>DePIN Node Reward Pool</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontFamily: MONO, color: '#f97316', fontWeight: 700 }}>
              {rewardPool.toFixed(4)} VGA = ${(rewardPool * vgaToUsd).toFixed(2)} pending
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '7px 16px', background: 'var(--c-elevated)' }}>
            {['Node ID', 'Contributions', 'Share', 'Pending Reward'].map(h => (
              <span key={h} style={{ fontSize: '0.55rem', fontFamily: MONO, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>
          {stats.nodeRewards.map((n, i) => (
            <div key={n.nodeId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 16px', borderTop: '1px solid var(--v-border-subtle)', alignItems: 'center' }}>
              <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: '#6366f1' }}>{n.nodeId}</span>
              <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: 'var(--c-text-2)' }}>{n.contributions}</span>
              <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: 'var(--c-text-2)' }}>{n.sharePct}%</span>
              <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: '#22c55e', fontWeight: 700 }}>{n.pendingRewardVga} VGA <span style={{ color: 'var(--c-text-3)' }}>(${n.pendingRewardUsd})</span></span>
            </div>
          ))}
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--v-border-subtle)', fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>
            20% of every VGA burn flows to this pool · distributed proportionally by verified hazard contributions
          </div>
        </div>
      )}

      {/* ── Audit trail ── */}
      <div style={{ background: 'var(--c-panel)', border: '1px solid var(--v-border-default)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--v-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flame size={13} color="#f97316" />
          <span style={{ fontSize: '0.62rem', fontWeight: 700, fontFamily: MONO, color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Billing & Audit Trail</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.56rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>Immutable on-chain records</span>
        </div>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', padding: '7px 16px', background: 'var(--c-elevated)' }}>
          {['Date', 'Tx Hash', 'VGA Burned', 'Credits'].map(h => (
            <span key={h} style={{ fontSize: '0.55rem', fontFamily: MONO, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
          ))}
        </div>
        {burnHistory.length === 0 ? (
          <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: '0.62rem', fontFamily: MONO, color: 'var(--c-text-3)' }}>
            No transactions yet — burn VGA to provision credits
          </div>
        ) : burnHistory.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', padding: '9px 16px', borderTop: '1px solid var(--v-border-subtle)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: 'var(--c-text-2)' }}>{r.date}</span>
            <a href={`${AMOY_SCAN}${r.tx}`} target="_blank" rel="noreferrer"
              style={{ fontSize: '0.62rem', fontFamily: MONO, color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              {r.tx.slice(0, 10)}…{r.tx.slice(-6)} <ExternalLink size={9} />
            </a>
            <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: '#f97316', fontWeight: 700 }}>{r.vga} VGA</span>
            <span style={{ fontSize: '0.62rem', fontFamily: MONO, color: '#22c55e', fontWeight: 700 }}>+{r.credits.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
