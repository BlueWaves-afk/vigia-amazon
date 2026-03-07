'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAgentRateLimitLock } from '../lib/client/agent-rate-limit-client';

const STORAGE_KEY = 'vigia_agent_usage';
const MAX_PER_MINUTE = 5;
const MAX_PER_HOUR = 30;

interface UsageData {
  requests: number[];
  hourlyRequests: number[];
}

export function AgentUsageIndicator() {
  const [showPopup, setShowPopup] = useState(false);
  const [usage, setUsage] = useState<UsageData>({ requests: [], hourlyRequests: [] });
  const { isLocked, secondsRemaining } = useAgentRateLimitLock();

  const updateUsage = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;
        const oneHourAgo = now - 60 * 60 * 1000;

        setUsage({
          requests: (data.requests || []).filter((t: number) => t > oneMinuteAgo),
          hourlyRequests: (data.hourlyRequests || []).filter((t: number) => t > oneHourAgo),
        });
        return;
      } catch (e) {
        console.error('Failed to parse usage data:', e);
      }
    }

    setUsage({ requests: [], hourlyRequests: [] });
  }, []);

  useEffect(() => {
    updateUsage();
    const interval = setInterval(updateUsage, 1000);

    const onAgentQuery = () => updateUsage();
    window.addEventListener('vigia-agent-query', onAgentQuery);
    return () => {
      clearInterval(interval);
      window.removeEventListener('vigia-agent-query', onAgentQuery);
    };
  }, [updateUsage]);

  const minuteUsage = usage.requests.length;
  const hourUsage = usage.hourlyRequests.length;
  const minutePercent = (minuteUsage / MAX_PER_MINUTE) * 100;
  const hourPercent = (hourUsage / MAX_PER_HOUR) * 100;
  const isLimited = isLocked || minuteUsage >= MAX_PER_MINUTE || hourUsage >= MAX_PER_HOUR;

  const getColor = (percent: number) => {
    if (percent >= 100) return 'var(--c-red)';
    if (percent >= 80) return 'var(--c-yellow)';
    if (percent >= 60) return 'var(--c-yellow)';
    return 'var(--c-green)';
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 12px',
        height: '100%',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
      onClick={() => setShowPopup(!showPopup)}
      title="Agent usage limits"
    >
      {/* VIGIA Icon */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke={getColor(Math.max(minutePercent, hourPercent))} strokeWidth="2" />
        <path d="M12 6v6l4 2" stroke={getColor(Math.max(minutePercent, hourPercent))} strokeWidth="2" strokeLinecap="round" />
      </svg>
      
      <span style={{ 
        fontSize: 11, 
        fontFamily: 'var(--v-font-ui)',
        lineHeight: 1,
        color: 'var(--v-sb-text)',
      }}>
        {isLocked ? `WAIT ${secondsRemaining}s` : `${hourUsage}/${MAX_PER_HOUR}`}
      </span>

      {/* Usage Popup */}
      {showPopup && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 8,
            width: 280,
            background: 'var(--c-elevated)',
            border: '1px solid var(--c-border)',
            borderRadius: 6,
            padding: 12,
            boxShadow: 'var(--v-shadow-md)',
            zIndex: 10000,
            fontFamily: 'var(--v-font-ui)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 12, color: 'var(--c-text)' }}>
            Agent Usage
          </div>

          {/* Per-Minute Usage */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--c-text-3)' }}>Per Minute</span>
              <span style={{ fontSize: '0.70rem', fontWeight: 500, color: getColor(minutePercent) }}>
                {minuteUsage}/{MAX_PER_MINUTE}
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--c-hover-md)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(minutePercent, 100)}%`,
                  background: getColor(minutePercent),
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Per-Hour Usage */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.70rem', color: 'var(--c-text-3)' }}>Per Hour</span>
              <span style={{ fontSize: '0.70rem', fontWeight: 500, color: getColor(hourPercent) }}>
                {hourUsage}/{MAX_PER_HOUR}
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--c-hover-md)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(hourPercent, 100)}%`,
                  background: getColor(hourPercent),
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Status Message */}
          <div style={{ fontSize: '0.68rem', color: isLimited ? 'var(--c-red)' : 'var(--c-text-3)', lineHeight: 1.4 }}>
            {isLocked ? (
              <>Rate limited — try again in {secondsRemaining}s.</>
            ) : isLimited ? (
              <>Rate limit reached. Wait before the next query.</>
            ) : (
              <>Agent available. {MAX_PER_HOUR - hourUsage} queries remaining this hour.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
