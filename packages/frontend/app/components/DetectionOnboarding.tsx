'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, KeyRound, ShieldCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useDeviceWallet } from '../hooks/useDeviceWallet';
import { Skeleton } from './Skeleton';

const DEVICE_KEY_STORAGE = 'vigia_device_pk';

const C = {
  bg: '#ffffff',
  panel: 'var(--v-hover)',
  elevated: 'var(--c-bg)',
  border: 'var(--c-border)',
  text: 'var(--c-text)',
  text2: 'var(--c-text-2)',
  text3: 'var(--c-text-3)',
  accent: 'var(--c-rose-2)',
  accentSoft: 'var(--c-rose-dim)',
  green: 'var(--c-green)',
  yellow: 'var(--c-yellow)',
};

const SANS = 'var(--v-font-ui)';
const MONO = 'var(--v-font-mono)';

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  gif: string;
  bullets: string[];
};

const SLIDES: Slide[] = [
  {
    id: 'overview',
    title: 'Detection Control Plane',
    subtitle: 'Enterprise-grade edge capture with verifiable provenance',
    gif: '/intro/output.gif',
    bullets: [
      'Each device signs telemetry using ECDSA for non-repudiation',
      'Cloud verification and reward logic remain server-side',
      'Audit trails are persisted for every hazard event',
    ],
  },
  {
    id: 'keys',
    title: 'Device Identity & Keypair',
    subtitle: 'Your edge node is registered before any detections are sent',
    gif: '/intro/output1.gif',
    bullets: [
      'Keys are generated locally and stored on-device',
      'Registry registration is idempotent and safe to retry',
      'Private keys never leave the browser',
    ],
  },
  {
    id: 'assumptions',
    title: 'Operational Assumptions',
    subtitle: 'Set expectations before running live detection',
    gif: '/intro/output2.gif',
    bullets: [
      'Dashcam frames are sampled at 5 FPS for inference',
      'GPS is captured from browser location or fallback',
      'Hazards are verified asynchronously by the VLM',
    ],
  },
];

function OnboardingSkeleton() {
  return (
    <div style={{
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
      background: C.bg,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 12,
      border: `1px solid ${C.border}`,
    }}>
      {/* Left */}
      <div style={{
        position: 'relative',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        borderRight: `1px solid ${C.border}`,
        minHeight: 0,
      }}>
        <Skeleton width={200} height={20} />
        <Skeleton width="80%" height={36} style={{ marginTop: 8 }} />
        <Skeleton width="60%" height={18} />
        <Skeleton variant="rectangular" height={260} style={{ borderRadius: 12, marginTop: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Skeleton variant="rectangular" height={60} style={{ borderRadius: 8 }} />
          <Skeleton variant="rectangular" height={60} style={{ borderRadius: 8 }} />
          <Skeleton variant="rectangular" height={60} style={{ borderRadius: 8 }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
          <Skeleton width={100} height={36} variant="rectangular" />
          <Skeleton width={150} height={36} variant="rectangular" />
        </div>
      </div>
      {/* Right */}
      <div style={{
        position: 'relative',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <Skeleton width={250} height={20} />
        <Skeleton variant="rectangular" height={200} style={{ borderRadius: 10 }} />
        <Skeleton variant="rectangular" height={150} style={{ borderRadius: 10 }} />
      </div>
    </div>
  );
}

export function DetectionOnboarding({ onComplete }: { onComplete: () => void }) {
  const device = useDeviceWallet();
  const [slideIndex, setSlideIndex] = useState(0);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [loading, setLoading] = useState(true);

  const keyReady = device.status === 'ready' && !!device.address;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500); // Simulate loading
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (device.status === 'ready') {
      setPrivateKey(localStorage.getItem(DEVICE_KEY_STORAGE));
    }
  }, [device.status]);

  const slide = SLIDES[slideIndex];

  const canAdvance = useMemo(() => {
    if (slide.id === 'keys') return keyReady;
    if (slideIndex === SLIDES.length - 1) return keyReady;
    return true;
  }, [slide.id, slideIndex, keyReady]);

  const statusLabel = useMemo(() => {
    if (device.status === 'loading') return 'Generating device keys…';
    if (device.status === 'error') return 'Key generation failed';
    return keyReady ? 'Device keypair ready' : 'Awaiting keypair';
  }, [device.status, keyReady]);

  const nextLabel = slideIndex === SLIDES.length - 1 ? 'Enter Detection Mode' : 'Next';

  if (loading) {
    return <OnboardingSkeleton />;
  }

  return (
    <div style={{
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
      background: C.bg,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 12,
      border: `1px solid ${C.border}`,
    }}>
      {/* Left: carousel */}
      <div style={{
        position: 'relative',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        borderRight: `1px solid ${C.border}`,
        minHeight: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: MONO,
          fontSize: '0.65rem',
          color: C.text3,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}>
          <span style={{
            padding: '2px 6px',
            borderRadius: 3,
            background: C.accentSoft,
            color: C.accent,
            fontWeight: 700,
          }}>Onboarding</span>
          <span>Detection Activity Group</span>
        </div>

        <div style={{ animation: 'onboard-fade 0.35s ease both' }}>
          <h2 style={{
            margin: 0,
            fontFamily: SANS,
            fontSize: '1.55rem',
            fontWeight: 600,
            color: C.text,
            letterSpacing: '-0.02em',
          }}>{slide.title}</h2>
          <p style={{
            margin: '6px 0 0',
            fontFamily: SANS,
            fontSize: '0.88rem',
            color: C.text2,
            lineHeight: 1.5,
          }}>{slide.subtitle}</p>
        </div>

        <div style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${C.border}`,
          background: C.elevated,
          minHeight: 260,
        }}>
          <img
            src={slide.gif}
            alt={slide.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '30%',
            background: 'linear-gradient(120deg, transparent 0%, color-mix(in srgb, var(--c-text) 18%, transparent) 50%, transparent 100%)',
            transform: 'translateX(-30%)',
            animation: 'onboard-sheen 4.6s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
        }}>
          {slide.bullets.map((item) => (
            <div key={item} style={{
              borderRadius: 8,
              padding: '10px 12px',
              background: C.panel,
              border: `1px solid ${C.border}`,
              fontFamily: SANS,
              fontSize: '0.72rem',
              color: C.text2,
              lineHeight: 1.45,
            }}>{item}</div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {SLIDES.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === slideIndex ? 22 : 8,
                height: 8,
                borderRadius: 999,
                background: i === slideIndex ? C.accent : C.border,
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
          <button
            onClick={() => setSlideIndex((s) => Math.max(0, s - 1))}
            disabled={slideIndex === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.panel,
              color: C.text2,
              fontFamily: MONO,
              fontSize: '0.7rem',
              cursor: slideIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: slideIndex === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          <button
            onClick={() => {
              if (slideIndex < SLIDES.length - 1) {
                setSlideIndex((s) => Math.min(SLIDES.length - 1, s + 1));
              } else {
                if (isCompleting) return;
                setIsCompleting(true);
                setTimeout(() => onComplete(), 480);
              }
            }}
            disabled={!canAdvance || isCompleting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.panel,
              color: canAdvance ? C.text2 : C.text3,
              fontFamily: MONO,
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: canAdvance && !isCompleting ? 'pointer' : 'not-allowed',
            }}
          >
            {isCompleting ? 'Loading workspace…' : nextLabel} <ChevronRight size={14} />
          </button>
          {!canAdvance && (
            <span style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.text3 }}>
              Complete key generation to continue.
            </span>
          )}
        </div>
      </div>

      {isCompleting && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--c-overlay)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
        }}>
          <div style={{
            padding: '18px 24px',
            borderRadius: 10,
            background: C.panel,
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: SANS,
            color: C.text,
          }}>
            <Loader2 size={16} className="animate-spin" style={{ color: C.accent }} />
            <span style={{ fontSize: '0.82rem' }}>Preparing detection workspace…</span>
          </div>
        </div>
      )}

      {/* Right: device registry + keygen */}
      <div style={{
        position: 'relative',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: SANS,
          fontSize: '0.78rem',
          color: C.text2,
        }}>
          <ShieldCheck size={16} style={{ color: C.accent }} />
          <span>Device registry & signing identity</span>
        </div>

        <div style={{
          padding: '16px 18px',
          borderRadius: 10,
          background: C.panel,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={14} style={{ color: C.accent }} />
              <span style={{ fontFamily: MONO, fontSize: '0.68rem', color: C.text3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Keypair Status
              </span>
            </div>
            <span style={{
              fontFamily: MONO,
              fontSize: '0.65rem',
              color: device.status === 'ready' ? C.green : device.status === 'error' ? C.yellow : C.text3,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {device.status === 'loading' && <Loader2 size={12} className="animate-spin" />}
              {statusLabel}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 8,
            fontFamily: MONO,
            fontSize: '0.7rem',
          }}>
            <div style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: C.elevated,
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ color: C.text3, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Device Address</div>
              <div style={{ color: C.text, marginTop: 4 }}>{device.address || '—'}</div>
            </div>

            <div style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: C.elevated,
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ color: C.text3, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Private Key</div>
              <div style={{ color: C.text, marginTop: 4 }}>
                {privateKey
                  ? (revealKey ? privateKey : `${privateKey.slice(0, 10)}…${privateKey.slice(-6)}`)
                  : '—'}
              </div>
              {privateKey && (
                <button
                  onClick={() => setRevealKey((v) => !v)}
                  style={{
                    marginTop: 6,
                    border: 'none',
                    background: 'transparent',
                    color: C.accent,
                    fontFamily: MONO,
                    fontSize: '0.62rem',
                    cursor: 'pointer',
                  }}
                >
                  {revealKey ? 'Hide key' : 'Reveal key'}
                </button>
              )}
            </div>
          </div>

          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 6,
            background: C.elevated,
            border: `1px solid ${C.border}`,
            fontFamily: SANS,
            fontSize: '0.7rem',
            color: C.text2,
          }}>
            Keypairs are generated automatically on this page and registered with the device registry.
          </div>
        </div>

        <div style={{
          padding: '16px 18px',
          borderRadius: 10,
          background: C.panel,
          border: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={14} style={{ color: C.green }} />
            <span style={{ fontFamily: SANS, fontSize: '0.78rem', color: C.text }}>Operational checklist</span>
          </div>
          {[
            'Device clock synchronized within 5 seconds',
            'Browser location permission granted',
            'Telemetry API reachable from edge network',
          ].map((item) => (
            <div key={item} style={{
              fontFamily: SANS,
              fontSize: '0.7rem',
              color: C.text2,
              padding: '8px 10px',
              borderRadius: 6,
              background: C.elevated,
              border: `1px solid ${C.border}`,
            }}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
