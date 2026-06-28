/**
 * PanicModeMockup.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated mockup for the Panic Mode feature section. Displays a code scaffold
 * in a dark terminal/editor panel with a typewriter reveal effect.
 *
 * Props:
 *   triggered     – set to true by FeatureSection when it enters the viewport
 *   reducedMotion – when true, renders the complete scaffold immediately
 *
 * Animation behaviour:
 *   - When `triggered && !reducedMotion`: each character is revealed one-by-one
 *     using setInterval at 18ms per character. The interval starts when
 *     `triggered` becomes true and clears once the full content is shown.
 *   - When `reducedMotion`: the full code scaffold is rendered immediately in
 *     its final state, no interval is used.
 *
 * Requirements: 4.7, 4.10
 */

import React, { useEffect, useRef, useState } from 'react';

interface PanicModeMockupProps {
  triggered: boolean;
  reducedMotion: boolean;
}

/** The code scaffold content shown inside the panel */
const SCAFFOLD = `// Panic Mode — React Lab scaffold
import React from 'react';

export default function ReactLab() {
  return (
    <div className="lab">
      {/* TODO: implement */}
    </div>
  );
}`;

/** 18ms per character as specified in the task */
const CHAR_INTERVAL_MS = 18;

const PanicModeMockup: React.FC<PanicModeMockupProps> = ({ triggered, reducedMotion }) => {
  // How many characters of SCAFFOLD are currently visible
  const [revealedCount, setRevealedCount] = useState<number>(
    reducedMotion ? SCAFFOLD.length : 0,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // When reduced motion is on, always show the full scaffold
    if (reducedMotion) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRevealedCount(SCAFFOLD.length);
      return;
    }

    // Start the typewriter when triggered
    if (triggered) {
      // Reset so the animation restarts if triggered goes false → true again
      setRevealedCount(0);

      intervalRef.current = setInterval(() => {
        setRevealedCount((prev) => {
          const next = prev + 1;
          if (next >= SCAFFOLD.length) {
            // Stop once the full content is revealed
            if (intervalRef.current !== null) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return SCAFFOLD.length;
          }
          return next;
        });
      }, CHAR_INTERVAL_MS);
    } else {
      // triggered is false — reset to blank (section scrolled back out)
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRevealedCount(0);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggered, reducedMotion]);

  const visibleText = SCAFFOLD.slice(0, revealedCount);
  const isComplete = revealedCount >= SCAFFOLD.length;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      aria-label="Panic Mode code scaffold mockup"
    >
      {/* ── Title bar (editor chrome) ─────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        {/* Traffic-light dots */}
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" aria-hidden="true" />

        {/* Filename pill */}
        <span
          className="ml-3 text-xs font-mono"
          style={{ color: 'var(--text-faint)' }}
        >
          ReactLab.tsx
        </span>

        {/* Status badge — shown when typewriter is running */}
        {triggered && !isComplete && !reducedMotion && (
          <span
            className="ml-auto text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              color: '#f59e0b',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
            aria-live="polite"
            aria-label="Generating scaffold"
          >
            ⚡ generating…
          </span>
        )}

        {/* Done badge */}
        {isComplete && (
          <span
            className="ml-auto text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              color: '#22c55e',
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            ✓ ready
          </span>
        )}
      </div>

      {/* ── Line-number gutter + code area ───────────────────────── */}
      <div
        className="flex font-mono text-xs leading-relaxed overflow-hidden"
        style={{ minHeight: '11rem' }}
      >
        {/* Gutter */}
        <div
          className="select-none px-3 py-4 text-right"
          style={{
            background: 'rgba(0,0,0,0.15)',
            borderRight: '1px solid var(--border-subtle)',
            color: 'var(--text-faint)',
            minWidth: '2.5rem',
            lineHeight: '1.6',
          }}
          aria-hidden="true"
        >
          {SCAFFOLD.split('\n').map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Code content */}
        <pre
          className="flex-1 px-4 py-4 overflow-x-auto whitespace-pre"
          style={{
            color: 'var(--text-secondary)',
            background: 'transparent',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          <CodeWithCursor
            text={visibleText}
            showCursor={triggered && !isComplete && !reducedMotion}
          />
        </pre>
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Renders the revealed text with basic syntax highlighting and a blinking
 * cursor at the insertion point while the typewriter is still running.
 */
const CodeWithCursor: React.FC<{ text: string; showCursor: boolean }> = ({
  text,
  showCursor,
}) => {
  return (
    <>
      <SyntaxHighlight code={text} />
      {showCursor && (
        <span
          className="panic-cursor"
          aria-hidden="true"
          style={{ display: 'inline-block', width: '2px' }}
        />
      )}
      {/* Scoped blink animation */}
      <style>{`
        @keyframes panic-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .panic-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: #22c55e;
          margin-left: 1px;
          vertical-align: text-bottom;
          animation: panic-blink 0.7s step-end infinite;
        }
      `}</style>
    </>
  );
};

/**
 * Minimal syntax highlighter — colours comments, keywords, strings, and JSX
 * tags without introducing a library dependency.
 */
const SyntaxHighlight: React.FC<{ code: string }> = ({ code }) => {
  const tokens = tokenize(code);
  return (
    <>
      {tokens.map((tok, i) => (
        <span key={i} style={{ color: TOKEN_COLORS[tok.type] }}>
          {tok.text}
        </span>
      ))}
    </>
  );
};

type TokenType = 'comment' | 'keyword' | 'string' | 'jsx-tag' | 'plain';

interface Token {
  type: TokenType;
  text: string;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  comment: '#6b7280',    // gray-500
  keyword: '#818cf8',    // indigo-400
  string: '#34d399',     // emerald-400
  'jsx-tag': '#38bdf8',  // sky-400
  plain: 'var(--text-secondary)',
};

const KEYWORDS = /\b(import|export|default|from|return|function|const|let|var|class|new|this|typeof|if|else|null|undefined|true|false)\b/g;
const STRINGS = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
const COMMENTS = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)/g;
const JSX_TAGS = /(<\/?[A-Za-z][A-Za-z0-9.]*(?:\s[^>]*)?\/??>)/g;

/**
 * Splits code into a flat token array. Simple pass — processes comment, string,
 * JSX tag, keyword patterns in priority order without a full parser.
 */
function tokenize(code: string): Token[] {
  const result: Token[] = [];
  let remaining = code;

  while (remaining.length > 0) {
    // Try comment first
    const commentMatch = COMMENTS.exec(remaining);
    COMMENTS.lastIndex = 0;
    const stringMatch = STRINGS.exec(remaining);
    STRINGS.lastIndex = 0;
    const jsxMatch = JSX_TAGS.exec(remaining);
    JSX_TAGS.lastIndex = 0;

    // Find the earliest match
    const candidates: Array<{ index: number; length: number; type: TokenType; text: string }> = [];

    if (commentMatch && commentMatch.index !== undefined) {
      candidates.push({
        index: commentMatch.index,
        length: commentMatch[0].length,
        type: 'comment',
        text: commentMatch[0],
      });
    }
    if (stringMatch && stringMatch.index !== undefined) {
      candidates.push({
        index: stringMatch.index,
        length: stringMatch[0].length,
        type: 'string',
        text: stringMatch[0],
      });
    }
    if (jsxMatch && jsxMatch.index !== undefined) {
      candidates.push({
        index: jsxMatch.index,
        length: jsxMatch[0].length,
        type: 'jsx-tag',
        text: jsxMatch[0],
      });
    }

    if (candidates.length === 0) {
      // No special tokens remain — highlight keywords in the rest
      result.push(...highlightKeywords(remaining));
      break;
    }

    // Sort by earliest occurrence
    candidates.sort((a, b) => a.index - b.index);
    const first = candidates[0];

    // Text before the match — apply keyword highlighting
    if (first.index > 0) {
      result.push(...highlightKeywords(remaining.slice(0, first.index)));
    }

    result.push({ type: first.type, text: first.text });
    remaining = remaining.slice(first.index + first.length);
  }

  return result;
}

function highlightKeywords(text: string): Token[] {
  const result: Token[] = [];
  let lastIndex = 0;

  KEYWORDS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = KEYWORDS.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'plain', text: text.slice(lastIndex, match.index) });
    }
    result.push({ type: 'keyword', text: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    result.push({ type: 'plain', text: text.slice(lastIndex) });
  }
  return result.length > 0 ? result : [{ type: 'plain', text }];
}

export default PanicModeMockup;
