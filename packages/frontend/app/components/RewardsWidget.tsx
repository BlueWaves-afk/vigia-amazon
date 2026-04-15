'use client';

import { useState, useEffect, useCallback } from 'react';
import { INNOVATION_API } from '../lib/constants';
import { claimRewards } from '../lib/contract';

const C = {
  panel:   'var(--c-panel)',
  border:  'var(--c-border)',
  text:    'var(--c-text)',
  textMut: 'var(--c-text-3)',
  accent:  'var(--c-accent-2)',
  green:   'var(--c-green)',
  red:     'var(--c-red)',
};

const fmt = (wei: string) => (Number(BigInt(wei)) / 1e18).toFixed(2);

type ClaimStatus = 'idle' | 'signing' | 'submitting' | 'confirmed' | 'error';

interface Props { walletAddress: string; }

export function RewardsWidget({ walletAddress }: Props) {
  const [pending,       setPending]       = useState('0');
  const [earned,        setEarned]        = useState('0');
  const [status,        setStatus]        = useState<ClaimStatus>('idle');
  const [txHash,        setTxHash]        = useState<string | null>(null);
  const [errMsg,        setErrMsg]        = useState<string | null>(null);
  const [lastHazardId,  setLastHazardId]  = useState<string | null>(null);
  const [traces,        setTraces]        = useState<string[] | null>(null);
  const [showTraces,    setShowTraces]    = useState(false);
  const [tracesLoading, setTracesLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`${INNOVATION_API}/rewards-balance?wallet_address=${walletAddress}`);
      const data = await res.json();
      if (!data.error) {
        setPending(data.pending_balance ?? '0');
        setEarned(data.total_earned ?? '0');
        setLastHazardId(data.last_hazard_id ?? null);
      }
    } catch (_) {}
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return; // wait until device wallet is ready
    fetchBalance();
    const id = setInterval(fetchBalance, 15000);
    return () => clearInterval(id);
  }, [fetchBalance, walletAddress]);

  const handleWithdraw = async () => {
    if (BigInt(pending) === 0n) return;
    const prevPending = pending;
    setPending('0'); // optimistic zero
    setStatus('signing');
    setErrMsg(null);
    setTxHash(null);

    try {
      const res = await fetch(`${INNOVATION_API}/claim-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });
      const { amount, nonce, signature, error } = await res.json();
      if (error) throw new Error(error);

      setStatus('submitting');
      const hash = await claimRewards(amount, nonce, signature);
      setTxHash(hash);
      setStatus('confirmed');
    } catch (e: any) {
      setPending(prevPending); // restore on failure
      setErrMsg(e.message ?? 'Claim failed');
      setStatus('error');
    }
  };

  const handleViewReasoning = async () => {
    if (!lastHazardId) return;
    if (showTraces && traces) { setShowTraces(false); return; }
    setTracesLoading(true);
    setShowTraces(true);
    try {
      const res = await fetch(`/api/traces/${encodeURIComponent(lastHazardId)}`);
      const data = await res.json();
      const steps: string[] = (data.traces ?? []).map((t: any) =>
        t.rationale ?? t.observation ?? t.invocation ?? JSON.stringify(t)
      ).filter(Boolean);
      setTraces(steps.length > 0 ? steps : ['No reasoning trace available for this hazard.']);
    } catch {
      setTraces(['Failed to load reasoning.']);
    } finally {
      setTracesLoading(false);
    }
  };

  const hasPending = BigInt(pending) > 0n;

  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: '10px 12px',
      fontFamily: 'var(--v-font-mono)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: '0.65rem', color: C.accent, letterSpacing: '0.08em', fontWeight: 700 }}>
          VGA REWARDS
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: C.textMut }}>
          {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
        </span>
      </div>

      {/* Balances */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: '0.6rem', color: C.textMut, marginBottom: 2 }}>PENDING</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: hasPending ? C.green : C.text }}>
            {fmt(pending)} VGA
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: C.textMut, marginBottom: 2 }}>LIFETIME</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>{fmt(earned)} VGA</div>
        </div>
      </div>

      {/* Withdraw button */}
      {status !== 'confirmed' && (
        <button
          onClick={handleWithdraw}
          disabled={!hasPending || status === 'signing' || status === 'submitting'}
          style={{
            width: '100%',
            padding: '6px 0',
            background: hasPending && status === 'idle' ? C.accent : 'var(--c-accent-glow)',
            color: hasPending && status === 'idle' ? 'var(--c-text)' : C.textMut,
            border: 'none',
            borderRadius: 4,
            fontSize: '0.65rem',
            fontWeight: 700,
            fontFamily: 'var(--v-font-mono)',
            letterSpacing: '0.06em',
            cursor: hasPending && status === 'idle' ? 'pointer' : 'not-allowed',
          }}
        >
          {status === 'signing'    ? 'SIGNING WITH KMS…'   :
           status === 'submitting' ? 'SUBMITTING TO CHAIN…' :
           status === 'error'      ? 'RETRY WITHDRAW'       :
           hasPending              ? 'WITHDRAW TO WALLET'   : 'NO PENDING REWARDS'}
        </button>
      )}

      {/* Confirmed */}
      {status === 'confirmed' && txHash && (
        <div style={{ fontSize: '0.6rem', color: C.green }}>
          Claimed ·{' '}
          <a
            href={`https://amoy.polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: C.accent }}
          >
            {txHash.slice(0, 14)}…
          </a>
        </div>
      )}

      {/* Error */}
      {status === 'error' && errMsg && (
        <div style={{ fontSize: '0.6rem', color: C.red, marginTop: 4 }}>
          Error: {errMsg.slice(0, 80)}
        </div>
      )}

      {/* View Reasoning */}
      {lastHazardId && (
        <button
          onClick={handleViewReasoning}
          style={{ marginTop: 8, width: '100%', padding: '5px 0', background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: '0.6rem', fontFamily: 'var(--v-font-mono)', color: C.accent, cursor: 'pointer', letterSpacing: '0.06em' }}
        >
          {showTraces ? '▲ HIDE REASONING' : '▼ VIEW REASONING'}
        </button>
      )}
      {showTraces && (
        <div style={{ marginTop: 6, borderLeft: `2px solid ${C.accent}`, paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tracesLoading
            ? <span style={{ fontSize: '0.58rem', color: C.textMut }}>Loading…</span>
            : (traces ?? []).map((t, i) => (
                <div key={i} style={{ fontSize: '0.58rem', color: C.textMut, lineHeight: 1.5 }}>
                  <span style={{ color: C.accent, marginRight: 4 }}>{i + 1}.</span>{t}
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
