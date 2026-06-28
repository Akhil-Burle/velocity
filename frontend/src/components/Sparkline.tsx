import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { SparklinePoint } from '../types';

interface SparklineProps {
  data: SparklinePoint[];
  color: string;
  width?: number;
  height?: number;
  live?: boolean;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color, width = 80, height = 32, live = false }) => {
  const pathRef = useRef<SVGPolylineElement>(null);

  // Guard: need at least 2 points to draw a sparkline
  const safeData = data && data.length >= 2 ? data : (data && data.length === 1 ? [data[0], data[0]] : [{ value: 50 }, { value: 50 }]);

  const max = Math.max(...safeData.map(d => d.value), 1);
  const min = Math.min(...safeData.map(d => d.value), 0);
  const range = max - min || 1;

  const pts = safeData.map((d, i) => {
    const x = (i / Math.max(safeData.length - 1, 1)) * width;
    const y = height - ((d.value - min) / range) * (height - 8) - 4;
    return { x, y };
  });

  const polylinePts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPts = [`0,${height}`, ...pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`), `${width},${height}`].join(' ');

  // Stroke-dashoffset draw-on animation
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength?.() ?? width * 1.2;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)';
      el.style.strokeDashoffset = '0';
    });
  }, [safeData.length, width]);

  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, '')}-${width}`;
  const last = pts[pts.length - 1];
  const pulseR = live ? 4 : 2.5;
  const pulseDuration = live ? 1.2 : 1.8;

  return (
    <div style={{ position: 'relative', display: 'inline-block', width, height: height + (live ? 10 : 0) }}>
      {/* LIVE badge */}
      {live && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          fontSize: 7, fontFamily: 'JetBrains Mono, monospace',
          color: '#22c55e', opacity: 0.9, lineHeight: 1,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <motion.span
            style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: '#22c55e' }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.0, repeat: Infinity }}
          />
          LIVE
        </div>
      )}

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible', marginTop: live ? 10 : 0, display: 'block' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <motion.polygon
          points={areaPts}
          fill={`url(#${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        {/* Line — plain SVG polyline, animated via useEffect */}
        <polyline
          ref={pathRef}
          points={polylinePts}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dot at end */}
        <motion.circle
          cx={last.x}
          cy={last.y}
          r={live ? 4 : 2.5}
          fill={color}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: live ? 0.9 : 1 }}
          transition={{ delay: 0.9, type: 'spring', stiffness: 280, damping: 16 }}
        />

        {/* Pulse ring */}
        <motion.circle
          cx={last.x}
          cy={last.y}
          r={pulseR}
          fill="none"
          stroke={color}
          strokeWidth={live ? 1.5 : 1}
          animate={{ r: [pulseR, pulseR + (live ? 6 : 4)], opacity: [live ? 0.75 : 0.55, 0] }}
          transition={{ duration: pulseDuration, repeat: Infinity, delay: 1.0 }}
        />
      </svg>
    </div>
  );
};

export default Sparkline;
