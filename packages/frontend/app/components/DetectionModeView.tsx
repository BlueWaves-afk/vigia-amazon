'use client';

import { useState, useEffect, useRef } from 'react';
import { VideoUploader } from './VideoUploader';
import { LiveMap } from './LiveMap';
import { HazardVerificationPanel } from './HazardVerificationPanel';

// JetBrains IDE color palette
const C = {
  bg:      'var(--c-bg)',
  panel:   'var(--c-panel)',
  border:  'var(--c-border)',
  accent:  'var(--c-accent-2)',
  text:    'var(--c-text)',
  textMut: 'var(--c-text-3)',
};

export function DetectionModeView() {
  const [leftWidth, setLeftWidth] = useState(20); // percentage for verification panel
  const [centerWidth, setCenterWidth] = useState(45); // percentage for detection node
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

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
      {/* Left: Hazard Verification Panel */}
      <div style={{ 
        width: `${leftWidth}%`, 
        height: '100%', 
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <HazardVerificationPanel />
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
          background: 'rgba(154,106,170,0.3)',
        }} />
      </div>

      {/* Center: Detection Node (VideoUploader) */}
      <div style={{ 
        width: `${centerWidth}%`, 
        height: '100%', 
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid rgba(154,106,170,0.2)`,
        overflow: 'hidden',
      }}>
        {/* Panel Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          padding: '0 12px',
          background: C.panel,
          borderBottom: `1px solid rgba(154,106,170,0.18)`,
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
        </div>
        
        {/* VideoUploader */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          padding: 16,
        }}>
          <VideoUploader />
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
          background: 'rgba(154,106,170,0.3)',
        }} />
      </div>

      {/* Right: Live Map (Unverified Hazards) */}
      <div style={{ 
        flex: 1, 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Panel Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          padding: '0 12px',
          background: C.panel,
          borderBottom: `1px solid rgba(154,106,170,0.18)`,
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
            Unverified Hazards
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
