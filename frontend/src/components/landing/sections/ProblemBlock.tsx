/**
 * ProblemBlock.tsx
 * A deliberately calm, typography-led breathing moment after the dense hero.
 */
import React from 'react';
import { Reveal, Eyebrow, useIsDark, pal } from './_landingShared';

const POINTS = [
  { n: '01', title: 'You set a reminder. You ignore it.', body: 'Passive alerts fire the same whether you\'re 10% done or 90% done. Zero behavioral information.' },
  { n: '02', title: 'Self-reports compound silently.', body: 'When you say "60% done", that number came from optimism, not evidence. The gap grows invisibly.' },
  { n: '03', title: 'Conflicts get quietly dropped.', body: 'Most tools auto-reschedule overlapping deadlines and pretend the problem resolved itself.' },
];

const ProblemBlock: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const isDark = useIsDark();
  const p = pal(isDark);
  return (
    <section id="problem" className="relative z-10 py-28 sm:py-40 px-5 sm:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <Reveal variant="blur" reducedMotion={reducedMotion}>
          <Eyebrow color="#ef4444">The problem with every other tool</Eyebrow>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.8rem)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.08, color: p.text }}>
            A speedometer shows you how fast.<br />
            <span style={{ color: p.textDim }}>It can't tell you if you're <span style={{ color: p.text }}>headed</span> off a cliff.</span>
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-10 gap-y-12 mt-20 text-left">
          {POINTS.map((pt, i) => (
            <Reveal key={pt.n} variant="up" delay={i * 0.12} reducedMotion={reducedMotion}>
              <div className="text-3xl font-black font-mono mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.16)' }}>{pt.n}</div>
              <h3 className="text-base font-bold mb-2" style={{ color: p.text }}>{pt.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: p.textFaint }}>{pt.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemBlock;
