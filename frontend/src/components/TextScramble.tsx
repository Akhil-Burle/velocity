import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function scramble(text: string, progress: number): string {
  return text
    .split('')
    .map((char, i) => {
      if (char === ' ') return ' ';
      if (i / text.length < progress) return char;
      return CHARS[Math.floor(Math.random() * CHARS.length)];
    })
    .join('');
}

interface TextScrambleProps {
  text: string;
  duration?: number;
  onComplete?: () => void;
}

const TextScramble: React.FC<TextScrambleProps> = ({ text, duration = 1000, onComplete }) => {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let start: number | null = null;
    let raf: number;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        setDisplayed(scramble(text, progress));
        raf = requestAnimationFrame(animate);
      } else {
        setDisplayed(text);
        setDone(true);
        onComplete?.();
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [text, duration, onComplete]);

  return (
    <motion.span
      className="font-mono text-green-400 text-sm tracking-widest"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {done ? (
        <span className="text-white">{displayed}</span>
      ) : (
        <span className="text-green-400">{displayed}</span>
      )}
    </motion.span>
  );
};

export default TextScramble;
