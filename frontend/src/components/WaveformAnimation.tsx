import React from 'react';
import { motion } from 'framer-motion';

const HEIGHTS = [6, 12, 18, 14, 8, 20, 10, 16, 6, 18, 12, 8, 20, 14, 6, 16, 10, 18, 8, 14];

const WaveformAnimation: React.FC = () => (
  <div className="flex items-center gap-[2px] h-6">
    {HEIGHTS.map((targetH, i) => (
      <motion.div
        key={i}
        className="w-[2px] rounded-full bg-green-400"
        style={{ originY: 0.5 }}
        animate={{ height: [4, targetH, 4], opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 0.7 + (i % 4) * 0.15,
          delay: i * 0.04,
          repeat: Infinity,
          ease: 'easeInOut',
          repeatType: 'mirror',
        }}
      />
    ))}
  </div>
);

export default WaveformAnimation;
