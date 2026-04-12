'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

const C = {
  bg: '#ffffff',
  panel: 'var(--c-panel)',
  elevated: 'var(--c-elevated)',
  border: 'var(--c-border)',
  text: 'var(--c-text)',
  text2: 'var(--c-text-2)',
  text3: 'var(--c-text-3)',
  accent: 'var(--c-rose-2)',
  accentSoft: 'var(--c-rose-dim)',
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

type ActivityOnboardingProps = {
  badge: string;
  title: string;
  subtitle: string;
  slides: Slide[];
  highlights: { title: string; detail: string }[];
  ctaLabel: string;
  onComplete: () => void;
};

export function ActivityOnboarding({ badge, title, subtitle, slides, highlights, ctaLabel, onComplete }: ActivityOnboardingProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const slide = slides[slideIndex];

  const nextLabel = slideIndex === slides.length - 1 ? ctaLabel : 'Next';
  const canAdvance = true;

  const header = useMemo(() => ({ title, subtitle }), [title, subtitle]);

  return (
    <div style={{
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '1.1fr 0.9fr',
      background: C.bg,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 12,
      border: `1px solid ${C.border}`,
    }}>
      <style>{`
        @keyframes onboard-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onboard-sheen {
          from { transform: translateX(-30%); opacity: 0; }
          20% { opacity: 1; }
          to { transform: translateX(120%); opacity: 0; }
        }
      `}</style>

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
          <span>{badge}</span>
        </div>

        <div style={{ animation: 'onboard-fade 0.35s ease both' }}>
          <h2 style={{
            margin: 0,
            fontFamily: SANS,
            fontSize: '1.55rem',
            fontWeight: 600,
            color: C.text,
            letterSpacing: '-0.02em',
          }}>{header.title}</h2>
          <p style={{
            margin: '6px 0 0',
            fontFamily: SANS,
            fontSize: '0.88rem',
            color: C.text2,
            lineHeight: 1.5,
          }}>{header.subtitle}</p>
        </div>

        <div style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${C.border}`,
          background: C.panel,
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
          {slides.map((_, i) => (
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
              if (slideIndex < slides.length - 1) {
                setSlideIndex((s) => Math.min(slides.length - 1, s + 1));
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
            <Sparkles size={16} style={{ color: C.accent }} />
            <span style={{ fontSize: '0.82rem' }}>Preparing workspace…</span>
          </div>
        </div>
      )}

      {/* Right: highlights */}
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
          <Sparkles size={16} style={{ color: C.accent }} />
          <span>Feature highlights</span>
        </div>

        <div style={{
          padding: '16px 18px',
          borderRadius: 10,
          background: C.panel,
          border: `1px solid ${C.border}`,
          display: 'grid',
          gap: 12,
        }}>
          {highlights.map((item) => (
            <div
              key={item.title}
              style={{
                borderRadius: 8,
                padding: '12px 14px',
                background: C.elevated,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontFamily: SANS, fontSize: '0.78rem', color: C.text, fontWeight: 600 }}>
                {item.title}
              </div>
              <div style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.text2, marginTop: 4, lineHeight: 1.5 }}>
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
