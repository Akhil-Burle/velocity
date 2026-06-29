/**
 * ScrollPath.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A single winding "trajectory" down the whole page. A glowing ball rides the
 * curve as you scroll, drawing the filled trail behind it, and pops a little
 * confetti each time it reaches a new section.
 *
 * Key design decisions (addressing real UX feedback):
 *  - The ball is driven by VERTICAL position, not arc length. We sample the path
 *    into a y→length table and look up the point at the scroll-mapped y. This
 *    means the ball descends in exact lockstep with your scroll — it never races
 *    ahead in the wiggly sections the way arc-length mapping does.
 *  - The curve hugs the page's side gutters (x ≈ 0.08–0.92), so the ball stays in
 *    the empty margins and is visible most of the time instead of hiding behind
 *    centered content. It sits behind content (z-1) and the line is very faint,
 *    so it never breaks any text.
 *  - Motion is lerp-smoothed in a self-halting rAF loop for buttery movement;
 *    only confetti touches React state, and only at section markers.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useIsDark } from './sections/_landingShared';

interface ScrollPathProps {
  reducedMotion?: boolean;
}

// Vertical-progress fractions where the ball "arrives" at a new section.
const MILESTONES = [0.17, 0.37, 0.56, 0.74, 0.9];
const CONFETTI_COLORS = ['#22c55e', '#4ade80', '#38bdf8', '#818cf8', '#fbbf24', '#34d399'];

/** Edge-hugging winding curve scaled to the measured pixel box (y monotonic). */
function buildPath(w: number, h: number): string {
  if (w <= 0 || h <= 0) return '';
  const x = (fx: number) => +(fx * w).toFixed(1);
  const y = (fy: number) => +(fy * h).toFixed(1);
  return [
    `M ${x(0.5)} ${y(0)}`,
    `C ${x(0.5)} ${y(0.045)}, ${x(0.9)} ${y(0.075)}, ${x(0.9)} ${y(0.14)}`,
    `C ${x(0.9)} ${y(0.22)}, ${x(0.1)} ${y(0.23)}, ${x(0.1)} ${y(0.31)}`,
    `C ${x(0.1)} ${y(0.40)}, ${x(0.92)} ${y(0.42)}, ${x(0.92)} ${y(0.51)}`,
    `C ${x(0.92)} ${y(0.60)}, ${x(0.08)} ${y(0.62)}, ${x(0.08)} ${y(0.70)}`,
    `C ${x(0.08)} ${y(0.79)}, ${x(0.9)} ${y(0.81)}, ${x(0.9)} ${y(0.89)}`,
    `C ${x(0.9)} ${y(0.955)}, ${x(0.5)} ${y(0.975)}, ${x(0.5)} ${y(1)}`,
  ].join(' ');
}

interface Burst { id: number; x: number; y: number; }

const ConfettiBurst: React.FC<{ x: number; y: number; onDone: () => void }> = ({ x, y, onDone }) => {
  const parts = useRef(
    Array.from({ length: 12 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 30;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist + 16,
        r: 1.4 + Math.random() * 2.2,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        dur: 0.7 + Math.random() * 0.4,
      };
    })
  ).current;

  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <g>
      <motion.circle cx={x} cy={y} fill="none" stroke="#4ade80" strokeWidth={1.5}
        initial={{ r: 4, opacity: 0.9 }} animate={{ r: 26, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }} />
      {parts.map((p, i) => (
        <motion.circle key={i} fill={p.color}
          initial={{ cx: x, cy: y, opacity: 1 }}
          animate={{ cx: x + p.dx, cy: y + p.dy, opacity: 0 }}
          transition={{ duration: p.dur, ease: 'easeOut' }}
          r={p.r} />
      ))}
    </g>
  );
};

const ScrollPath: React.FC<ScrollPathProps> = ({ reducedMotion = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const ballRef = useRef<SVGGElement>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const celebrated = useRef<Set<number>>(new Set());
  const burstId = useRef(0);

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [bursts, setBursts] = useState<Burst[]>([]);
  const isDark = useIsDark();

  useEffect(() => {
    const parent = svgRef.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const w = parent.clientWidth;
      const h = parent.scrollHeight;
      setDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    const t = setTimeout(measure, 400);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, []);

  const pathD = useMemo(() => buildPath(dims.w, dims.h), [dims.w, dims.h]);

  useEffect(() => {
    const path = pathRef.current;
    const glow = glowRef.current;
    const ball = ballRef.current;
    if (!path || !pathD || dims.h <= 0) return;

    const total = path.getTotalLength();

    // Sample the path into a y→{length,x} table (y is monotonic along the curve).
    const N = 700;
    const ys = new Float32Array(N + 1);
    const xs = new Float32Array(N + 1);
    const ls = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const len = (total * i) / N;
      const pt = path.getPointAtLength(len);
      ys[i] = pt.y; xs[i] = pt.x; ls[i] = len;
    }
    const lookup = (targetY: number) => {
      if (targetY <= ys[0]) return { len: ls[0], x: xs[0] };
      if (targetY >= ys[N]) return { len: ls[N], x: xs[N] };
      let lo = 0, hi = N;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (ys[mid] < targetY) lo = mid + 1; else hi = mid; }
      const a = Math.max(0, lo - 1), b = lo;
      const span = ys[b] - ys[a] || 1;
      const t = (targetY - ys[a]) / span;
      return { len: ls[a] + (ls[b] - ls[a]) * t, x: xs[a] + (xs[b] - xs[a]) * t };
    };

    for (const p of [path, glow]) {
      if (!p) continue;
      p.style.strokeDasharray = `${total}`;
      p.style.strokeDashoffset = `${total}`;
    }

    const render = (cRaw: number) => {
      const c = Math.max(0, Math.min(1, cRaw));
      const targetY = c * dims.h;
      const { len, x } = lookup(targetY);
      path.style.strokeDashoffset = `${total - len}`;
      if (glow) glow.style.strokeDashoffset = `${total - len}`;
      if (ball) {
        if (c > 0.003 && c < 0.999) {
          ball.setAttribute('transform', `translate(${x.toFixed(1)} ${targetY.toFixed(1)})`);
          ball.style.opacity = '1';
          for (let i = 0; i < MILESTONES.length; i++) {
            if (!celebrated.current.has(i) && c >= MILESTONES[i]) {
              celebrated.current.add(i);
              if (!reducedMotion) {
                const id = ++burstId.current;
                setBursts((prev) => [...prev, { id, x, y: targetY }]);
              }
            }
          }
        } else {
          ball.style.opacity = '0';
        }
      }
    };

    const computeTarget = () => {
      // Pin the ball to a fixed on-screen band (~52% viewport height) and map
      // that to a position along the curve. This keeps it perfectly in lockstep
      // with scroll (never faster) and always on-screen instead of drifting off.
      const parentEl = svgRef.current?.parentElement;
      const wrapperTop = parentEl ? parentEl.getBoundingClientRect().top + window.scrollY : 0;
      const yInWrapper = window.scrollY + window.innerHeight * 0.52 - wrapperTop;
      return Math.max(0, Math.min(1, yInWrapper / dims.h));
    };

    if (reducedMotion) { currentRef.current = 1; render(1); return; }

    const loop = () => {
      const target = targetRef.current;
      const cur = currentRef.current;
      const next = cur + (target - cur) * 0.16; // lerp toward scroll target
      currentRef.current = Math.abs(target - next) < 0.0004 ? target : next;
      render(currentRef.current);
      if (Math.abs(target - currentRef.current) > 0.0004) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        runningRef.current = false;
      }
    };
    const kick = () => {
      if (!runningRef.current) { runningRef.current = true; rafRef.current = requestAnimationFrame(loop); }
    };
    const onScroll = () => { targetRef.current = computeTarget(); kick(); };

    targetRef.current = computeTarget();
    currentRef.current = targetRef.current;
    render(currentRef.current);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
  }, [reducedMotion, pathD, dims.h]);

  const removeBurst = (id: number) => setBursts((b) => b.filter((x) => x.id !== id));

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
      viewBox={`0 0 ${dims.w || 100} ${dims.h || 1000}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="vTrajectory" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <radialGradient id="vBall" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#aef0c8" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
      </defs>

      {/* faint full-length rail — barely-there route */}
      <path d={pathD} fill="none" stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.07)'} strokeWidth={1.5} />
      {/* soft filled trail underlay */}
      <path ref={glowRef} d={pathD} fill="none" stroke="url(#vTrajectory)"
        strokeWidth={6} strokeLinecap="round" style={{ opacity: 0.14, filter: 'blur(4px)' }} />
      {/* crisp filled trail — kept very faint so text always wins */}
      <path ref={pathRef} d={pathD} fill="none" stroke="url(#vTrajectory)"
        strokeWidth={1.8} strokeLinecap="round" style={{ opacity: 0.28 }} />

      {bursts.map((b) => (
        <ConfettiBurst key={b.id} x={b.x} y={b.y} onDone={() => removeBurst(b.id)} />
      ))}

      <g ref={ballRef} style={{ opacity: 0, transition: 'opacity 0.3s ease' }}>
        <circle r={14} fill="#22c55e" opacity={0.16} style={{ filter: 'blur(3px)' }} />
        {!reducedMotion && (
          <motion.circle r={9} fill="none" stroke="#4ade80" strokeWidth={1}
            animate={{ r: [8, 13, 8], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
        )}
        <circle r={5.5} fill="url(#vBall)" style={{ filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.9))' }} />
      </g>
    </svg>
  );
};

export default ScrollPath;
