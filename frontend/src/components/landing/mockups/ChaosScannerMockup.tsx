import { useEffect, useRef } from 'react';

interface ChaosScannerMockupProps {
  triggered: boolean;
  reducedMotion: boolean;
}

const TASK_ITEMS = [
  { id: 1, label: 'Submit final report', urgency: 'high',   due: 'Today 5 pm' },
  { id: 2, label: 'Review PR #204',       urgency: 'medium', due: 'Today 6 pm' },
  { id: 3, label: 'Push hotfix to prod',  urgency: 'high',   due: 'Today 6 pm' },
  { id: 4, label: 'Team standup notes',   urgency: 'low',    due: 'Tomorrow'   },
  { id: 5, label: 'Update Jira tickets',  urgency: 'medium', due: 'Tomorrow'   },
];

const URGENCY_STYLES: Record<string, string> = {
  high:   'text-red-400   bg-red-400/10   border-red-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low:    'text-sky-400   bg-sky-400/10   border-sky-400/30',
};

/**
 * ChaosScannerMockup
 *
 * Renders a chaotic task board with a green laser-scan overlay.
 *
 * Animation behaviour:
 *   - When `triggered && !reducedMotion`: a semi-transparent green bar sweeps
 *     translateX(-100% → 100%) over 1.2 s using a CSS @keyframes animation.
 *     The class `.chaos-scan--active` is toggled via useEffect each time
 *     `triggered` changes.
 *   - When `reducedMotion`: items are rendered in their final post-scan
 *     (highlighted) state immediately — no sweep occurs.
 *
 * Requirements: 4.5, 4.10
 */
export default function ChaosScannerMockup({
  triggered,
  reducedMotion,
}: ChaosScannerMockupProps) {
  const scanBarRef = useRef<HTMLDivElement>(null);

  /* Toggle the CSS animation class whenever triggered state changes */
  useEffect(() => {
    const bar = scanBarRef.current;
    if (!bar) return;

    // Remove the class first to allow re-triggering when triggered resets and
    // fires again (force a reflow so the browser restarts the animation).
    bar.classList.remove('chaos-scan--active');

    if (triggered && !reducedMotion) {
      // Trigger a reflow so removing and re-adding the class restarts the animation
      void bar.offsetWidth; // eslint-disable-line @typescript-eslint/no-unused-expressions
      bar.classList.add('chaos-scan--active');
    }
  }, [triggered, reducedMotion]);

  /* In reduced-motion mode, show items in their final scanned/highlighted state */
  const isScanned = reducedMotion || triggered;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
      }}
      aria-label="Chaos Scanner mockup"
    >
      {/* ── Header bar ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {/* Traffic-light dots */}
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span
          className="ml-3 text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-faint)' }}
        >
          Task Board
        </span>
        {/* Scan indicator pill — fades in when scanning is complete */}
        <span
          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full transition-opacity duration-500"
          style={{
            color: '#22c55e',
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.3)',
            opacity: isScanned ? 1 : 0,
          }}
        >
          ✓ Scanned
        </span>
      </div>

      {/* ── Task list ────────────────────────────────────────────────── */}
      <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {TASK_ITEMS.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 transition-colors duration-500"
            style={{
              background: isScanned
                ? item.urgency === 'high'
                  ? 'rgba(239,68,68,0.06)'
                  : 'transparent'
                : 'transparent',
            }}
          >
            {/* Urgency badge */}
            <span
              className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${URGENCY_STYLES[item.urgency]}`}
            >
              {item.urgency}
            </span>

            {/* Task label */}
            <span
              className="flex-1 text-sm truncate"
              style={{
                color: isScanned && item.urgency === 'high'
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
                fontWeight: isScanned && item.urgency === 'high' ? 600 : 400,
              }}
            >
              {item.label}
            </span>

            {/* Due date */}
            <span
              className="shrink-0 text-xs tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              {item.due}
            </span>

            {/* Landmine warning — visible post-scan for high urgency */}
            {isScanned && item.urgency === 'high' && (
              <span
                className="shrink-0 text-sm transition-opacity duration-300"
                aria-label="High urgency warning"
                title="Deadline conflict risk"
              >
                💣
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* ── Green laser-scan overlay ──────────────────────────────────
           The bar starts at translateX(-100%) and sweeps to translateX(100%).
           The `.chaos-scan--active` class triggers the keyframe animation.
           We only render it at all when reduced motion is off.
      ─────────────────────────────────────────────────────────────── */}
      {!reducedMotion && (
        <div
          ref={scanBarRef}
          className="chaos-scan-bar pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
      )}

      {/* ── Inline keyframes + class definitions ─────────────────────
           Scoped to this component via a style tag to avoid polluting globals
           while still using a class-toggled animation (not inline style).
      ─────────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes chaos-sweep {
          from { transform: translateX(-100%); }
          to   { transform: translateX(200%); }
        }

        .chaos-scan-bar {
          /* A narrow vertical green beam */
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(34, 197, 94, 0.18) 40%,
            rgba(34, 197, 94, 0.55) 50%,
            rgba(34, 197, 94, 0.18) 60%,
            transparent 100%
          );
          width: 60%;
          transform: translateX(-100%);
        }

        .chaos-scan-bar.chaos-scan--active {
          animation: chaos-sweep 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
