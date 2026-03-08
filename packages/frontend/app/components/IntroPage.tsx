'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, ArrowRight,
  Globe, Activity, Shield, Cpu, Radio, Map,
  BarChart3, Eye,
} from 'lucide-react';

/* ─── constants ─────────────────────────────────────────────── */
const STORAGE_KEY = 'vigia-intro-completed';

interface Slide {
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  accentFrom: string;
  accentTo: string;
  screenshotLabel: string;
  screenshot: string;
}

const slides: Slide[] = [
  {
    tag: 'Welcome',
    title: 'Welcome to VIGIA',
    subtitle: 'Sentient Road Infrastructure Platform',
    description:
      'VIGIA is a next-generation geospatial intelligence platform that uses AI-powered detection, decentralized ledger technology, and swarm coordination to monitor and protect road infrastructure at scale.',
    icon: <Globe size={28} />,
    features: [
      'AI-driven hazard detection in real time',
      'Decentralized DePIN ledger for verified reports',
      'Privacy-preserving federated analytics',
    ],
    accentFrom: '#6366f1',
    accentTo: '#a78bfa',
    screenshotLabel: 'VIGIA Dashboard Overview',
    screenshot: '/intro/output.gif',
  },
  {
    tag: 'Explore',
    title: 'Geo Explorer',
    subtitle: 'Navigate your road network visually',
    description:
      'The interactive Geo Explorer gives you a real-time map view of your entire road network. Browse sessions, inspect geohash regions, and drill into individual hazard reports with a single click.',
    icon: <Map size={28} />,
    features: [
      'Live map with clustered hazard markers',
      'Session-based browsing with tree explorer',
      'Geohash region filtering and search',
    ],
    accentFrom: '#3b82f6',
    accentTo: '#06b6d4',
    screenshotLabel: 'Geo Explorer — Interactive Map View',
    screenshot: '/intro/output1.gif',
  },
  {
    tag: 'Detect',
    title: 'AI Detection',
    subtitle: 'Automated hazard identification',
    description:
      'Upload dashcam or drone footage and let VIGIA\'s onboard AI models identify potholes, cracks, debris, and other road hazards automatically — with bounding-box precision and confidence scoring.',
    icon: <Eye size={28} />,
    features: [
      'Video upload with frame-by-frame analysis',
      'Bounding-box overlay on detected hazards',
      'Confidence scores and severity classification',
    ],
    accentFrom: '#8b5cf6',
    accentTo: '#d946ef',
    screenshotLabel: 'Detection Mode — AI Analysis',
    screenshot: '/intro/output2.gif',
  },
  {
    tag: 'Verify',
    title: 'DePIN Ledger',
    subtitle: 'Decentralized verification & trust',
    description:
      'Every hazard report is anchored to an immutable decentralized ledger. Community validators verify detections, building a trusted, tamper-proof record of road conditions across your network.',
    icon: <Shield size={28} />,
    features: [
      'Immutable hazard verification records',
      'Community-driven validation consensus',
      'Transparent audit trail and compliance',
    ],
    accentFrom: '#10b981',
    accentTo: '#34d399',
    screenshotLabel: 'Ledger — Verified Hazard Records',
    screenshot: '/intro/screenshot-ledger.png',
  },
  {
    tag: 'Coordinate',
    title: 'Network Intelligence',
    subtitle: 'Swarm coordination at city scale',
    description:
      'Coordinate maintenance crews, prioritize repairs by severity and traffic volume, and monitor your fleet of sensor nodes in real time with VIGIA\'s network intelligence dashboard.',
    icon: <Radio size={28} />,
    features: [
      'Real-time node health and connectivity',
      'AI-prioritized maintenance work orders',
      'Fleet-wide analytics and KPI tracking',
    ],
    accentFrom: '#f59e0b',
    accentTo: '#f97316',
    screenshotLabel: 'Network Dashboard — Swarm View',
    screenshot: '/intro/screenshot-network.png',
  },
];

/* ─── helpers ───────────────────────────────────────────────── */
function Dot({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      className={`intro-dot${active ? ' intro-dot--active' : ''}`}
      onClick={onClick}
      aria-label="Go to slide"
    />
  );
}

/* ─── component ─────────────────────────────────────────────── */
export function IntroPage({ onComplete }: { onComplete: () => void }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [mounted, setMounted] = useState(false);
  const total = slides.length;

  useEffect(() => { setMounted(true); }, []);

  const go = useCallback(
    (idx: number) => {
      if (animating || idx === current) return;
      setDirection(idx > current ? 'next' : 'prev');
      setAnimating(true);
      setCurrent(idx);
      setTimeout(() => setAnimating(false), 500);
    },
    [current, animating],
  );

  const next = useCallback(() => go(Math.min(current + 1, total - 1)), [current, go, total]);
  const prev = useCallback(() => go(Math.max(current - 1, 0)), [current, go]);

  const slide = slides[current];
  const slideDurationMs = slide.tag === 'Detect' ? 16000 : 12000;

  useEffect(() => {
    const duration = slides[current].tag === 'Detect' ? 16000 : 12000;
    const id = window.setTimeout(() => {
      if (!animating) {
        go((current + 1) % total);
      }
    }, duration);
    return () => window.clearTimeout(id);
  }, [current, total, animating, go]);

  /* keyboard navigation */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Enter' && current === total - 1) finish();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [current, next, prev, total]);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    onComplete();
  };

  const isLast = current === total - 1;
  const fadeUp = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  };
  const fadeUpFast = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <>
    <div className="intro-root">
      {/* ── Ambient background ─────────── */}
      <div className="intro-bg">
        <div
          className="intro-bg__orb intro-bg__orb--1"
          style={{ background: `radial-gradient(circle, ${slide.accentFrom}22 0%, transparent 70%)` }}
        />
        <div
          className="intro-bg__orb intro-bg__orb--2"
          style={{ background: `radial-gradient(circle, ${slide.accentTo}18 0%, transparent 70%)` }}
        />
        <div className="intro-bg__grid" />
      </div>

      {/* ── Top bar ────────────────────── */}
      <header className="intro-topbar">
        <div className="intro-topbar__brand">
          <img src="/logo.svg" alt="VIGIA" className="intro-topbar__logo" />
          <span className="intro-topbar__name">VIGIA</span>
        </div>
        <button className="intro-skip" onClick={finish}>
          Skip intro
        </button>
      </header>

      <div className="intro-scroll">
        {/* ── Hero + Carousel ───────────────── */}
        <section className="intro-hero" id="top">
          <motion.div className="intro-hero__copy" {...fadeUp}>
            <span className="intro-hero__eyebrow">Infrastructure Intelligence · VIGIA IDE</span>
            <h1 className="intro-hero__title">
              Road Intelligence IDE
            </h1>
            <p className="intro-hero__subhead">Monitor, plan, and secure road infrastructure.</p>
            <p className="intro-hero__lead">
              Monitor, plan, and secure road infrastructure with a next-generation platform built
              for public safety, operational clarity, and city-scale resilience.
            </p>
            <div className="intro-hero__actions">
              <a className="intro-btn intro-btn--primary" href="#tour">
                Start the tour
                <ArrowRight size={16} />
              </a>
              <a className="intro-btn intro-btn--ghost" href="#pricing">
                View pricing
              </a>
            </div>
            <div className="intro-hero__meta">
              <span><Eye size={14} /> 48 live nodes</span>
              <span><BarChart3 size={14} /> 99.3% verified accuracy</span>
              <span><Cpu size={14} /> 120ms median detection</span>
            </div>
          </motion.div>

          <motion.div className="intro-hero__media" {...fadeUpFast}>
            <div className="intro-video-card intro-video-card--center">
              <div className="intro-video intro-video--logo">
                <img src="/logo.svg" alt="VIGIA" className="intro-video__logo" />
                <button 
                  className="intro-video__cta" 
                  type="button"
                  onClick={() => setShowVideo(true)}
                >
                  Watch the film
                </button>
              </div>
            </div>

            <div className="intro-carousel" id="tour">
              <div className="intro-carousel__head">
                <span className="intro-carousel__tag">{slide.tag}</span>
                <div className="intro-carousel__nav">
                  <button className="intro-nav-icon" onClick={prev} disabled={current === 0} aria-label="Previous slide">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="intro-nav-icon" onClick={next} disabled={current === total - 1} aria-label="Next slide">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="intro-carousel__loader" key={`loader-${current}`}>
                <span
                  className="intro-carousel__loader-bar"
                  style={{ animationDuration: `${slideDurationMs}ms` }}
                />
              </div>

            <AnimatePresence mode="wait">
              <motion.div
                className={`intro-visual intro-visual--${direction}`}
                key={`visual-${current}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className="intro-screenshot"
                  style={{
                    borderColor: `${slide.accentFrom}25`,
                    boxShadow: `0 0 90px ${slide.accentFrom}12, 0 24px 60px rgba(0,0,0,0.45)`,
                  }}
                >
                  <div className="intro-screenshot__titlebar">
                    <span className="intro-screenshot__dots">
                      <span style={{ background: '#ff5f57' }} />
                      <span style={{ background: '#febc2e' }} />
                      <span style={{ background: '#28c840' }} />
                    </span>
                    <span className="intro-screenshot__url">vigia.app/{slide.tag.toLowerCase()}</span>
                  </div>
                  <div className="intro-screenshot__body intro-screenshot__body--img">
                    <img
                      src={slide.screenshot}
                      alt={slide.screenshotLabel}
                      className="intro-screenshot__img"
                      draggable={false}
                    />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                className={`intro-text intro-text--${direction}`}
                key={`text-${current}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 className="intro-carousel__title">{slide.title}</h2>
                <p className="intro-carousel__desc">{slide.description}</p>
                <ul className="intro-features">
                  {slide.features.map((f, i) => (
                    <li key={i} className="intro-feature" style={{ animationDelay: `${0.12 + i * 0.08}s` }}>
                      <span className="intro-feature__text">{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

              <div className="intro-carousel__foot">
                <div className="intro-dots">
                  {slides.map((_, i) => (
                    <Dot key={i} active={i === current} onClick={() => go(i)} />
                  ))}
                </div>
                <div className="intro-progress">
                  <div
                    className="intro-progress__bar"
                    style={{
                      width: `${((current + 1) / total) * 100}%`,
                      background: `linear-gradient(90deg, ${slide.accentFrom}, ${slide.accentTo})`,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Feature band ───────────────── */}
        <motion.section className="intro-band" {...fadeUpFast}>
          <div className="intro-band__card">
            <span className="intro-band__icon"><Activity size={18} /></span>
            <h3>Real-time orchestration</h3>
            <p>Live routing, prioritized remediation, and operational clarity across every corridor.</p>
          </div>
          <div className="intro-band__card">
            <span className="intro-band__icon"><Shield size={18} /></span>
            <h3>Verified signals</h3>
            <p>DePIN consensus and ledger-backed audits ensure every report stays trusted.</p>
          </div>
          <div className="intro-band__card">
            <span className="intro-band__icon"><Radio size={18} /></span>
            <h3>City-grade resilience</h3>
            <p>Multi-node redundancy, predictive health scoring, and proactive maintenance.</p>
          </div>
        </motion.section>

        {/* ── Pricing ─────────────────────── */}
        <motion.section className="intro-pricing" id="pricing" {...fadeUpFast}>
          <div className="intro-pricing__header">
            <span className="intro-hero__eyebrow">Pricing</span>
            <h2>Built for cities, scalable for nations.</h2>
            <p>Transparent pricing that grows with your operational footprint.</p>
          </div>
          <div className="intro-pricing__grid">
            <div className="intro-price-card">
              <div className="intro-price-card__top">
                <h3>Pilot</h3>
                <p>For regional trials and early deployments.</p>
              </div>
              <div className="intro-price-card__price">$7,500<span>/month</span></div>
              <ul>
                <li>Up to 12 nodes</li>
                <li>AI detection + verification</li>
                <li>Priority onboarding</li>
              </ul>
              <button className="intro-btn intro-btn--ghost">Request pilot</button>
            </div>
            <div className="intro-price-card intro-price-card--featured">
              <div className="intro-price-card__top">
                <h3>City</h3>
                <p>Full operational coverage with advanced analytics.</p>
              </div>
              <div className="intro-price-card__price">$18,500<span>/month</span></div>
              <ul>
                <li>Up to 120 nodes</li>
                <li>Live maintenance orchestration</li>
                <li>Dedicated success engineer</li>
              </ul>
              <button className="intro-btn intro-btn--primary">Start city plan</button>
            </div>
            <div className="intro-price-card">
              <div className="intro-price-card__top">
                <h3>National</h3>
                <p>Enterprise-grade, multi-region deployments.</p>
              </div>
              <div className="intro-price-card__price">Custom<span>/year</span></div>
              <ul>
                <li>Unlimited nodes</li>
                <li>On-prem or sovereign cloud</li>
                <li>24/7 network operations center</li>
              </ul>
              <button className="intro-btn intro-btn--ghost">Talk to sales</button>
            </div>
          </div>
        </motion.section>

        {/* ── Final CTA ──────────────────── */}
        <motion.section className="intro-final" {...fadeUpFast}>
          <div>
            <h2>Ready to deploy VIGIA?</h2>
            <p>Elevate your infrastructure intelligence in days, not months.</p>
          </div>
          <button className="intro-btn intro-btn--primary intro-btn--cta" onClick={finish}>
            Get Started
            <ArrowRight size={16} />
          </button>
        </motion.section>
      </div>

    </div>

    {/* ── Video Modal (Apple-style) — portaled to body ── */}
    {mounted && createPortal(
      <AnimatePresence>
        {showVideo && (
          <motion.div
            className="intro-film-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              className="intro-film-overlay__close"
              onClick={() => setShowVideo(false)}
              aria-label="Close video"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M1 1L17 17M17 1L1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="intro-film-overlay__container">
              <video
                src="https://vigia-static-assets-1772997117.s3.us-east-1.amazonaws.com/intro/demo.mov"
                controls
                autoPlay
                className="intro-film-overlay__video"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}

export function useIntroComplete(): [boolean, () => void] {
  const [done, setDone] = useState(true); // default true to avoid flash
  useEffect(() => {
    try {
      setDone(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDone(false);
    }
  }, []);
  const complete = useCallback(() => setDone(true), []);
  return [done, complete];
}
