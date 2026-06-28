import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonCardProps {
  isDark?: boolean;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ isDark = true }) => {
  const bg     = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.85)';
  const border = isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.07)';
  const bar1   = isDark ? '#1c1c22' : '#e2e8f0';
  const bar2   = isDark ? '#161619' : '#e8edf3';
  const shimmer= isDark
    ? 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.04) 50%,transparent 100%)'
    : 'linear-gradient(90deg,transparent 0%,rgba(0,0,0,0.03) 50%,transparent 100%)';

  return (
    <div className="rounded-xl p-5 overflow-hidden relative" style={{ background: bg, border: `1px solid ${border}` }}>
      <motion.div className="absolute inset-0 pointer-events-none"
        style={{ background: shimmer, backgroundSize: '200% 100%' }}
        animate={{ backgroundPositionX: ['200%', '-200%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} />
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded-full w-3/5" style={{ background: bar1 }} />
          <div className="h-2.5 rounded-full w-1/4" style={{ background: bar2 }} />
        </div>
        <div className="h-5 w-14 rounded-full" style={{ background: bar2 }} />
      </div>
      <div className="space-y-2.5 mt-5">
        <div className="h-2.5 rounded-full w-2/5" style={{ background: bar2 }} />
        <div className="h-2.5 rounded-full w-1/3" style={{ background: bar2 }} />
        <div className="h-2.5 rounded-full w-1/2" style={{ background: bar1 }} />
      </div>
      <div className="mt-5 flex justify-end">
        <div className="h-7 w-20 rounded" style={{ background: bar2 }} />
      </div>
    </div>
  );
};

export default SkeletonCard;
