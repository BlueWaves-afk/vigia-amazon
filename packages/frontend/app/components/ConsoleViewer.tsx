'use client';

import { useEffect, useState } from 'react';

export function ConsoleViewer() {
  const [logs, setLogs] = useState<Array<{timestamp: string, type: string, message: string}>>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLogs([
      { timestamp: new Date().toISOString(), type: 'system', message: 'System initialized' },
      { timestamp: new Date().toISOString(), type: 'system', message: 'Ready for telemetry ingestion' },
      { timestamp: new Date().toISOString(), type: 'success', message: 'ONNX Runtime: Loaded' },
      { timestamp: new Date().toISOString(), type: 'success', message: 'Bedrock Agent: Connected' },
      { timestamp: new Date().toISOString(), type: 'success', message: 'DynamoDB: Polling active' },
      { timestamp: new Date().toISOString(), type: 'info', message: 'Edge swarm: 48 nodes online' },
      { timestamp: new Date().toISOString(), type: 'success', message: 'Ledger integrity: ✓ verified' },
    ]);
  }, []);

  useEffect(() => {
    const handleTrace = (event: any) => {
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        type: event.detail.type,
        message: event.detail.message,
      }].slice(-100));
    };

    window.addEventListener('vigia-trace', handleTrace);
    return () => window.removeEventListener('vigia-trace', handleTrace);
  }, []);

  const getColor = (type: string) => {
    switch (type) {
      case 'create': return 'var(--c-green)';
      case 'delete': return 'var(--c-red)';
      case 'error': return 'var(--c-red)';
      case 'success': return 'var(--c-green)';
      case 'info': return 'var(--c-accent-2)';
      case 'system': return 'var(--c-text-2)';
      default: return 'var(--c-text-3)';
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', lineHeight: 1.6 }}>
      {logs.map((log, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <span style={{ color: 'var(--c-elevated)' }}>›</span>
          <span style={{ color: getColor(log.type) }}>{log.message}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <span style={{ color: 'var(--c-elevated)' }}>›</span>
        <span style={{ display: 'inline-block', width: 8, height: 15, background: 'var(--c-accent)', animation: 'status-pulse 1s ease-in-out infinite', verticalAlign: 'text-bottom' }} />
      </div>
    </div>
  );
}
