'use client';

import { useState, useEffect, useRef } from 'react';
import { VideoUploader } from './VideoUploader';
import { LiveMap } from './LiveMap';
import { HazardVerificationPanel } from './HazardVerificationPanel';
import { RewardsWidget } from './RewardsWidget';
import { useDeviceWallet } from '../hooks/useDeviceWallet';
import { Skeleton } from './Skeleton';

// JetBrains IDE color palette
const C = {
  bg:      '#fff',
  panel:   'var(--v-hover)',
  border:  'var(--v-border-default)',
  accent:  'var(--c-accent-2)',
  text:    'var(--c-text)',
  textMut: 'var(--c-text-3)',
};

function DetectionModeSkeleton() {
  const panelStyle = {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  };

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      width: '100%',
      background: C.bg,
      padding: 8,
      gap: 8,
    }}>
      {/* Left */}
      <div style={{ width: '20%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, ...panelStyle }}>
        <Skeleton variant="rectangular" height="70%" style={{ borderRadius: 6 }} />
        <Skeleton variant="rectangular" height="30%" style={{ borderRadius: 6 }} />
      </div>

      {/* Center */}
      <div style={{ width: '45%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, ...panelStyle }}>
        <Skeleton variant="rectangular" height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
        <Skeleton variant="rectangular" height="100%" style={{ borderRadius: 6 }} />
      </div>

      {/* Right */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, ...panelStyle }}>
        <Skeleton variant="rectangular" height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
        <Skeleton variant="rectangular" height="100%" style={{ borderRadius: 6 }} />
      </div>
    </div>
  );
}

export function DetectionModeView() {
  const device = useDeviceWallet();
  const [leftWidth, setLeftWidth] = useState(20); // percentage for verification panel
  const [centerWidth, setCenterWidth] = useState(45); // percentage for detection node
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500); // Simulate loading
    return () => clearTimeout(timer);
  }, []);

  const handleLeftMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeft.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      if (isDraggingLeft.current) {
        const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
        setLeftWidth(Math.max(15, Math.min(35, newWidth)));
      }
      
      if (isDraggingRight.current) {
        const centerStart = leftWidth;
        const newCenterWidth = ((e.clientX - rect.left) / rect.width) * 100 - centerStart;
        setCenterWidth(Math.max(30, Math.min(60, newCenterWidth)));
      }
    };

    const handleMouseUp = () => {
      isDraggingLeft.current = false;
      isDraggingRight.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftWidth]);

  if (loading) {
    return <DetectionModeSkeleton />;
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        display: 'flex', 
        height: '100%', 
        width: '100%',
        background: C.bg,
      }}
    >
      {/* Left: Hazard Verification Panel + Rewards Widget */}
      <div style={{ 
        width: `${leftWidth}%`, 
        height: '100%', 
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: C.panel,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        margin: 8,
      }}>
        <div style={{ flex: 1, overflow: 'hidden', borderBottom: `1px solid ${C.border}` }}>
          <HazardVerificationPanel deviceAddress={device.address} signPayload={device.signPayload} />
        </div>
        <div style={{ padding: '8px', flexShrink: 0 }}>
          <RewardsWidget walletAddress={device.address} />
        </div>
      </div>

      {/* Left Resize Handle */}
      <div
        onMouseDown={handleLeftMouseDown}
        style={{
          width: 6,
          cursor: 'ew-resize',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-accent-glow)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ 
          width: 2, 
          height: 32, 
          borderRadius: 1, 
          background: 'var(--c-border-md)',
        }} />
      </div>

      {/* Center: Detection Node (VideoUploader) */}
      <div style={{ 
        width: `${centerWidth}%`, 
        height: '100%', 
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: C.panel,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        margin: '8px 0',
      }}>
        {/* Panel Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          height: 38,
          padding: '0 12px',
          background: 'transparent',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <span style={{ 
            fontSize: '0.7rem', 
            fontWeight: 600, 
            color: C.text,
            fontFamily: "var(--v-font-mono)",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Detection Node
          </span>
          <span style={{
            marginLeft: 8,
            fontSize: '0.6rem',
            color: C.textMut,
            fontFamily: "var(--v-font-mono)",
          }}>
            ONNX v26 · 5 FPS
          </span>
          {/* Edge Node Authentication Badge */}
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.6rem',
            fontFamily: "var(--v-font-mono)",
            color: device.status === 'ready' ? 'var(--c-green)' : device.status === 'error' ? 'var(--c-red)' : C.textMut,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {device.status === 'ready'  && <>Edge Node Authenticated &nbsp;<strong>{device.address.slice(0, 6)}...</strong></>}
            {device.status === 'loading' && <>Registering node...</>}
            {device.status === 'error'   && <>Node offline</>}
          </span>
        </div>
        
        {/* VideoUploader */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          padding: 16,
        }}>
          <VideoUploader deviceAddress={device.address} signPayload={device.signPayload} />
        </div>
      </div>

      {/* Right Resize Handle */}
      <div
        onMouseDown={handleRightMouseDown}
        style={{
          width: 6,
          cursor: 'ew-resize',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-accent-glow)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ 
          width: 2, 
          height: 32, 
          borderRadius: 1, 
          background: 'var(--c-border-md)',
        }} />
      </div>

      {/* Right: Live Map (Unverified Hazards) */}
      <div style={{ 
        flex: 1, 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: C.panel,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        margin: 8,
      }}>
        {/* Panel Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          height: 38,
          padding: '0 12px',
          background: 'transparent',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <span style={{ 
            fontSize: '0.7rem', 
            fontWeight: 600, 
            color: C.text,
            fontFamily: "var(--v-font-mono)",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Live Map
          </span>
          <span style={{
            marginLeft: 8,
            fontSize: '0.6rem',
            color: C.textMut,
            fontFamily: "var(--v-font-mono)",
          }}>
            Unverified Hazards · Real-time
          </span>
          <div style={{ 
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-green)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '0.6rem', color: 'var(--c-green)', fontFamily: "var(--v-font-mono)" }}>
              LIVE
            </span>
          </div>
        </div>
        
        {/* LiveMap */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LiveMap />
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
