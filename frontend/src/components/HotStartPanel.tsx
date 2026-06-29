import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, Zap, Copy, Check, CheckCircle } from 'lucide-react';

interface HotStartPanelProps {
  taskName: string;
  code: string;
  isDark?: boolean;
  onClose: () => void;
  onMarkComplete: () => void;
}

const KEYWORDS = [
  'import', 'export', 'default', 'const', 'let', 'var', 'return', 'async', 'await', 'try', 'catch',
  'if', 'else', 'interface', 'from', 'React', 'useState', 'useEffect', 'function', 'class', 'new',
  'type', 'SELECT', 'FROM', 'WHERE', 'CREATE', 'INDEX', 'JOIN', 'LEFT', 'WITH', 'AS', 'ON', 'GROUP',
  'BY', 'ORDER', 'DESC', 'COALESCE', 'COUNT', 'INTERVAL', 'NOW', 'EXPLAIN', 'ANALYZE', 'CONCURRENTLY',
];
const TYPES = ['FC', 'string', 'boolean', 'unknown', 'void', 'number', 'React'];

const HotStartPanel: React.FC<HotStartPanelProps> = ({ taskName, code, isDark = true, onClose, onMarkComplete }) => {
  const [whyOpen, setWhyOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = code.split('\n');
  const fileName = taskName.toLowerCase().includes('react') ? 'LabComponent.tsx'
    : taskName.toLowerCase().includes('dbms') ? 'optimization.sql' : 'notes.md';

  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const panelBg = isDark ? 'linear-gradient(120deg,#0d1117 0%,#0a0e14 100%)' : 'linear-gradient(120deg,#ffffff 0%,#f8fafc 100%)';
  const panelBorder = isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.3)';
  const titleBarBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const lineNumBg = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)';
  const whyBg = isDark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.06)';
  const whyBorder = isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.18)';

  return (
    <>
      {/* Dim backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-x-0 bottom-0 z-[49]"
        style={{ top: 57, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
      />

      <motion.div
        initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="fixed right-0 bottom-0 w-full max-w-[480px] z-50 flex flex-col"
        style={{ top: 57, background: panelBg, borderLeft: `1px solid ${panelBorder}`, boxShadow: `-20px 0 60px rgba(0,0,0,0.45), -4px 0 24px rgba(34,197,94,0.05)` }}
      >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${divider}`, background: titleBarBg }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-green-400" />
            <span className="text-xs font-mono font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>HOT-START Scaffold</span>
          </div>
        </div>
        <motion.button onClick={handleCopy} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: 'var(--text-tertiary)' }}>
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </motion.button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center px-4 shrink-0" style={{ borderBottom: `1px solid ${divider}`, background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)' }}>
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-green-400" style={{ borderBottom: '1.5px solid #22c55e' }}>
          <span style={{ color: 'var(--text-faint)' }}>⬡</span><span>{fileName}</span>
        </div>
        <div className="px-3 py-2 text-xs font-mono" style={{ color: 'var(--text-faint)' }}>App.tsx</div>
      </div>

      {/* Code editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex text-xs font-mono">
          <div className="select-none shrink-0 pt-4 pb-4" style={{ background: lineNumBg, borderRight: `1px solid ${divider}`, minWidth: '42px' }}>
            {lines.map((_, i) => (
              <div key={i} className="text-right pr-3 leading-[1.65rem]" style={{ color: 'var(--text-faint)' }}>{i + 1}</div>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-x-auto">
            <pre className="leading-[1.65rem] whitespace-pre" style={{ color: 'var(--text-secondary)' }}>
              {lines.map((line, i) => (
                <div key={i} className="px-1 rounded transition-colors" style={{ ':hover': { background: 'rgba(255,255,255,0.025)' } } as React.CSSProperties}>
                  <SyntaxLine line={line} isDark={isDark} />
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>

      {/* Why toggle */}
      <div className="shrink-0" style={{ borderTop: `1px solid ${divider}` }}>
        <motion.button onClick={() => setWhyOpen(!whyOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors"
          style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-mono font-bold">?</span>
            <span className="font-mono">Why was this generated?</span>
          </div>
          {whyOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </motion.button>
        <AnimatePresence>
          {whyOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-4 py-3 text-xs leading-relaxed font-mono" style={{ background: whyBg, borderTop: `1px solid ${whyBorder}` }}>
                <span style={{ color: 'var(--text-faint)' }}>// Velocity AI · Reason{'\n'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  You fell <span className="text-red-400 font-bold">60% behind</span> expected velocity.
                  Generating boilerplate to <span className="text-green-400">eliminate initialization friction</span> and accelerate time-to-first-commit.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mark Complete + Close */}
      <div className="shrink-0 px-4 py-4" style={{ borderTop: `1px solid ${divider}` }}>
        <div className="flex gap-2">
          <motion.button onClick={onMarkComplete}
            whileHover={{ scale: 1.02, boxShadow: '0 0 24px rgba(34,197,94,0.25)' }} whileTap={{ scale: 0.97 }}
            className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold text-black"
            style={{ background: 'linear-gradient(135deg,#22c55e 0%,#16a34a 100%)' }}>
            <CheckCircle size={15} />Mark Task Complete
          </motion.button>
          <motion.button onClick={onClose}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', color: 'var(--text-primary)', border: `1px solid ${divider}` }}>
            <X size={15} />
            Close
          </motion.button>
        </div>
        <p className="text-center text-[10px] font-mono mt-2" style={{ color: 'var(--text-faint)' }}>
          Marks complete · dismisses panel · recalibrates board
        </p>
      </div>
    </motion.div>
    </>
  );
};

// ─── Syntax highlighter ───────────────────────────────────────────────────

function SyntaxLine({ line, isDark }: { line: string; isDark: boolean }) {
  const commentColor = isDark ? '#6b7280' : '#94a3b8';  // gray-500 — readable on dark
  if (line.trim().startsWith('//') || line.trim().startsWith('--') || line.trim().startsWith('#')) {
    return <span style={{ color: commentColor }}>{line}</span>;
  }
  const tokens: { text: string; color?: string }[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "'" || line[i] === '"' || line[i] === '`') {
      const q = line[i]; let j = i + 1;
      while (j < line.length && line[j] !== q) j++;
      tokens.push({ text: line.slice(i, j + 1), color: isDark ? '#f59e0b' : '#b45309' }); i = j + 1; continue;
    }
    let matched = false;
    for (const kw of [...KEYWORDS, ...TYPES]) {
      if (line.slice(i).startsWith(kw)) {
        const after = line[i + kw.length];
        if (!after || /\W/.test(after)) {
          tokens.push({ text: kw, color: TYPES.includes(kw) ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#c084fc' : '#7c3aed') });
          i += kw.length; matched = true; break;
        }
      }
    }
    if (!matched) {
      if (tokens.length && !tokens[tokens.length - 1].color) tokens[tokens.length - 1].text += line[i];
      else tokens.push({ text: line[i] });
      i++;
    }
  }
  return <>{tokens.map((t, idx) => <span key={idx} style={t.color ? { color: t.color } : { color: isDark ? '#e2e8f0' : '#374151' }}>{t.text}</span>)}</>;
}

export default HotStartPanel;
