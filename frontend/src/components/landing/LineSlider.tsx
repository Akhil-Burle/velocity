/**
 * LineSlider.tsx — curved SVG scroll progress indicator
 *
 * Renders a fixed right-side SVG that draws a sinusoidal curve as the user
 * scrolls. The path "writes itself" via stroke-dashoffset animation driven
 * by requestAnimationFrame. At each section milestone a glow pulse + particles
 * burst from the tip of the curve.
 *
 * Requirements: 5.1–5.8, 10.9
 */

import { useEffect, useRef } from 'react';
import { computeFillRatio } from './LineSlider';

const SECTION_IDS = ['hero', 'feature-showcase', 'stats', 'narrative', 'testimonial', 'cta'];

const TRACK_W = 32;   // SVG viewport width
const TRACK_H = '100vh';
const STYLE_ID = 'ls-curved-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    .lsc-wrap {
      position: fixed;
      right: 0;
      top: 0;
      width: ${TRACK_W}px;
      height: 100vh;
      z-index: 9999;
      pointer-events: none;
      overflow: visible;
    }

    .lsc-track-path {
      fill: none;
      stroke: rgba(255,255,255,0.08);
      stroke-width: 2;
      stroke-linecap: round;
    }

    .lsc-fill-path {
      fill: none;
      stroke: #22c55e;
      stroke-width: 2.5;
      stroke-linecap: round;
      filter: drop-shadow(0 0 4px rgba(34,197,94,0.6));
      transition: filter 0.3s ease;
    }

    .lsc-fill-path.milestone-glow {
      animation: lsc-glow-pulse 0.6s ease-out forwards;
    }

    @keyframes lsc-glow-pulse {
      0%   { filter: drop-shadow(0 0 4px rgba(34,197,94,0.6)); }
      40%  { filter: drop-shadow(0 0 12px rgba(34,197,94,1)) drop-shadow(0 0 20px rgba(34,197,94,0.5)); }
      100% { filter: drop-shadow(0 0 4px rgba(34,197,94,0.6)); }
    }

    .lsc-knob {
      fill: #22c55e;
      filter: drop-shadow(0 0 5px rgba(34,197,94,0.8));
    }

    .lsc-particle {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #22c55e;
      pointer-events: none;
      animation: lsc-particle-fly 0.65s ease-out forwards;
    }

    @keyframes lsc-particle-fly {
      0%   { opacity: 1; transform: translate(0, 0) scale(1); }
      100% { opacity: 0; transform: var(--lsc-end); }
    }

    /* Compact mode ≤375px */
    @media (max-width: 375px) {
      .lsc-wrap { width: 12px; right: 4px; }
    }
  `;
  document.head.appendChild(s);
}

/** Build a sinusoidal cubic bezier SVG path for the full height.
 *  The path oscillates left-right within the 32px-wide strip.
 *  We generate N segments so the curve crosses the center multiple times. */
function buildPath(h: number, amplitude = 10, cycles = 5): string {
  const cx = TRACK_W / 2;
  const step = h / cycles;
  let d = `M ${cx} 0`;
  for (let i = 0; i < cycles; i++) {
    const y0 = i * step;
    const y1 = y0 + step;
    const hDir = i % 2 === 0 ? 1 : -1;
    const cp1x = cx + hDir * amplitude;
    const cp1y = y0 + step * 0.25;
    const cp2x = cx - hDir * amplitude;
    const cp2y = y0 + step * 0.75;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${cx} ${y1}`;
  }
  return d;
}

/** Approximate total length of the bezier path using a polyline sample */
function approximateLength(pathEl: SVGPathElement): number {
  return pathEl.getTotalLength();
}

export default function LineSlider() {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const svgRef   = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const fillRef  = useRef<SVGPathElement>(null);
  const knobRef  = useRef<SVGCircleElement>(null);

  useEffect(() => {
    injectStyles();

    const wrap  = wrapRef.current;
    const svg   = svgRef.current;
    const track = trackRef.current;
    const fill  = fillRef.current;
    const knob  = knobRef.current;
    if (!wrap || !svg || !track || !fill || !knob) return;

    const h = window.innerHeight;
    const pathD = buildPath(h);

    track.setAttribute('d', pathD);
    fill.setAttribute('d', pathD);

    // Compute total path length for dash animation
    const totalLen = approximateLength(track);
    fill.style.strokeDasharray  = String(totalLen);
    fill.style.strokeDashoffset = String(totalLen); // fully hidden initially

    // Milestone ratios
    const milestoneRatios: number[] = [];
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        milestoneRatios.push(Math.min(1, Math.max(0, maxScroll > 0 ? top / maxScroll : 0)));
      }
    }
    milestoneRatios.sort((a, b) => a - b);

    const crossed = new Set<number>();
    const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lastFrame = performance.now();
    let lowPerf = false;
    let rafId: number;

    function tick(now: number) {
      const delta = now - lastFrame;
      lastFrame = now;
      lowPerf = delta > 33;

      const scrollY = window.scrollY;
      const ms = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = computeFillRatio(scrollY, ms);

      // Update dash offset to draw the path up to the fill ratio
      const offset = totalLen * (1 - ratio);
      fill.style.strokeDashoffset = String(offset);

      // Move knob to current tip position on the path
      const pt = track.getPointAtLength(ratio * totalLen);
      knob.setAttribute('cx', String(pt.x));
      knob.setAttribute('cy', String(pt.y));

      const reduced = reducedMQ.matches;

      // Milestone crossings
      for (let i = 0; i < milestoneRatios.length; i++) {
        if (!crossed.has(i) && ratio >= milestoneRatios[i]) {
          crossed.add(i);
          if (!reduced) {
            fill.classList.remove('milestone-glow');
            void fill.offsetWidth;
            fill.classList.add('milestone-glow');
            setTimeout(() => fill.classList.remove('milestone-glow'), 600);

            if (!lowPerf) spawnParticles(wrap, pt.x, pt.y);
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div ref={wrapRef} className="lsc-wrap" aria-hidden="true" role="presentation">
      <svg ref={svgRef} width={TRACK_W} height={TRACK_H} style={{ overflow: 'visible' }}>
        <path ref={trackRef} className="lsc-track-path" />
        <path ref={fillRef}  className="lsc-fill-path"  />
        <circle ref={knobRef} className="lsc-knob" r={5} cx={TRACK_W / 2} cy={0} />
      </svg>
    </div>
  );
}

function spawnParticles(container: HTMLDivElement, px: number, py: number) {
  const rect = container.getBoundingClientRect();
  const COUNT = 6;
  for (let i = 0; i < COUNT; i++) {
    const angle = (Math.PI * 2 * i) / COUNT - Math.PI / 2;
    const dist  = 14 + Math.random() * 14;
    const ex = Math.cos(angle) * dist;
    const ey = Math.sin(angle) * dist;

    const p = document.createElement('span');
    p.className = 'lsc-particle';
    p.style.setProperty('--lsc-end', `translate(${ex}px, ${ey}px) scale(0)`);
    p.style.left = `${rect.left + px - 2}px`;
    p.style.top  = `${rect.top + py - 2}px`;
    p.style.position = 'fixed';
    p.style.animationDelay = `${Math.random() * 60}ms`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}
