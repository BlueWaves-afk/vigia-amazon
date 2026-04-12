'use client';

import React from 'react';

export const Skeleton = ({
  width,
  height,
  className,
  style,
  variant = 'text',
  count = 1,
  animation = 'shimmer',
  shimmerColor,
  shimmerHighlightColor,
  shimmerDuration = 1.6,
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'text' | 'circular' | 'rectangular';
  count?: number;
  animation?: 'shimmer' | 'pulse' | false;
  shimmerColor?: string;
  shimmerHighlightColor?: string;
  shimmerDuration?: number;
}) => {
  const C = {
    bg: shimmerColor || 'var(--v-hover)',
    highlight: shimmerHighlightColor || 'var(--v-hover-md)',
  };

  const shimmerStyle: React.CSSProperties = {
    background: `linear-gradient(90deg, ${C.bg} 25%, ${C.highlight} 50%, ${C.bg} 75%)`,
    backgroundSize: '200% 100%',
    animation: `mt-shimmer ${shimmerDuration}s ease-in-out infinite`,
  };

  const pulseStyle: React.CSSProperties = {
    background: C.bg,
    animation: `pulse ${shimmerDuration}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
  };

  const animationStyle = animation === 'shimmer' ? shimmerStyle : animation === 'pulse' ? pulseStyle : { background: C.bg };

  const styles: React.CSSProperties = {
    display: 'block',
    width: width || '100%',
    height: height || '1em',
    ...animationStyle,
    ...style,
  };

  if (variant === 'circular') {
    styles.borderRadius = '50%';
  } else if (variant === 'rectangular') {
    styles.borderRadius = '3px';
  } else {
    // Text variant
    styles.borderRadius = '3px';
    if (!height) styles.height = '0.9em';
  }

  const elements = [];
  for (let i = 0; i < count; i++) {
    elements.push(
      <span
        key={i}
        className={className}
        style={{
          ...styles,
          animationDelay: `${i * 0.1}s`,
          marginBottom: count > 1 ? '0.25em' : 0,
        }}
      >&zwnj;</span>
    );
  }

  return (
    <>
      <style>{`
        @keyframes mt-shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes pulse {
          50% { opacity: 0.5; }
        }
      `}</style>
      {elements}
    </>
  );
};
