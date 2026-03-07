'use client';

import { useState, useEffect } from 'react';

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

  useEffect(() => {
    const updateUsage = () => {
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
        } catch (e) {
          console.error('Failed to parse usage data:', e);
        }
      }
    };

    updateUsage();
    const interval = setInterval(updateUsage, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for agent queries
  useEffect(() => {
    const handleQuery = () => {
      const now = Date.now();
      const stored = localStorage.getItem(STORAGE_KEY);
      let data: UsageData = { requests: [], hourlyRequests: [] };
      
      if (stored) {
        try {
          data = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse usage data:', e);
        }
      }

      data.requests.push(now);
      data.hourlyRequests.push(now);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setUsage(data);
    };

    window.addEventListener('vigia-agent-query', handleQuery);
    return () => window.removeEventListener('vigia-agent-query', handleQuery);
  }, []);

  const minuteUsage = usage.requests.length;
  const hourUsage = usage.hourlyRequests.length;
  const minutePercent = (minuteUsage / MAX_PER_MINUTE) * 100;
  const hourPercent = (hourUsage / MAX_PER_HOUR) * 100;
  const isLimited = minuteUsage >= MAX_PER_MINUTE || hourUsage >= MAX_PER_HOUR;

  const getColor = (percent: number) => {
    if (percent >= 100) return '#EF4444'; // Red
    if (percent >= 80) return '#F59E0B'; // Orange
    if (percent >= 60) return '#EAB308'; // Yellow
    return '#10B981'; // Green
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
        fontFamily: 'Inter, system-ui, sans-serif',
        lineHeight: 1,
        color: 'var(--v-sb-text)',
      }}>
        {hourUsage}/{MAX_PER_HOUR}
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
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: 6,
            padding: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 10000,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 12, color: '#1F2937' }}>
            Agent Usage
          </div>

          {/* Per-Minute Usage */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.70rem', color: '#6B7280' }}>Per Minute</span>
              <span style={{ fontSize: '0.70rem', fontWeight: 500, color: getColor(minutePercent) }}>
                {minuteUsage}/{MAX_PER_MINUTE}
              </span>
            </div>
            <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
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
              <span style={{ fontSize: '0.70rem', color: '#6B7280' }}>Per Hour</span>
              <span style={{ fontSize: '0.70rem', fontWeight: 500, color: getColor(hourPercent) }}>
                {hourUsage}/{MAX_PER_HOUR}
              </span>
            </div>
            <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
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
          <div style={{ fontSize: '0.68rem', color: isLimited ? '#EF4444' : '#6B7280', lineHeight: 1.4 }}>
            {isLimited ? (
              <>⚠️ Rate limit reached. Wait before next query.</>
            ) : (
              <>✓ Agent available. {MAX_PER_HOUR - hourUsage} queries remaining this hour.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
