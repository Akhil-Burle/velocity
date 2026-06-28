/**
 * ChaosScanner.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Feature Block 1: Multi-modal vision input.
 * Drag & drop zone → base64 → Gemini Vision → structured tasks.
 */
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import WaveformAnimation from './WaveformAnimation';
import { Task } from '../types';
import { scanImageForTasks } from '../api';

interface ChaosScannerProps {
  onTasksExtracted: (tasks: Task[]) => void;
  isDark?: boolean;
}

type ScanState = 'idle' | 'dragging' | 'processing' | 'done' | 'error';

const ChaosScanner: React.FC<ChaosScannerProps> = ({ onTasksExtracted, isDark = true }) => {
  const [state, setState] = useState<ScanState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const processFile = useCallback(async (file: File) => {
    if (state === 'processing') return;
    setState('processing');

    // Create a local preview URL for the scan animation background
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        const mimeType = file.type || 'image/jpeg';
        const tasks = await scanImageForTasks(base64, mimeType);

        setTaskCount(tasks.length);
        setState('done');
        onTasksExtracted(tasks);

        // Reset after 2.5s
        setTimeout(() => {
          setState('idle');
          setPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }, 2500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Image scan failed';
        setErrorMsg(msg);
        setState('error');
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Could not read file. Try a different image.');
      setState('error');
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    };
    reader.readAsDataURL(file);
  }, [state, onTasksExtracted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: state === 'processing' || state === 'done',
    onDrop: (accepted, rejected) => {
      if (accepted.length > 0) {
        processFile(accepted[0]);
      } else if (rejected.length > 0) {
        const err = rejected[0]?.errors?.[0]?.message ?? 'File rejected — try a smaller image';
        setErrorMsg(err);
        setState('error');
      }
    },
  });

  // Compute the actual display state (isDragActive overrides stored state)
  const displayState: ScanState = isDragActive && state === 'idle' ? 'dragging' : state;

  const borderStyle = {
    idle:       '1px dashed rgba(34,197,94,0.3)',
    dragging:   '1px solid rgba(34,197,94,0.7)',
    processing: '1px solid rgba(34,197,94,0.4)',
    done:       '1px solid rgba(34,197,94,0.5)',
    error:      '1px solid rgba(239,68,68,0.5)',
  }[displayState];

  const bgStyle = {
    idle:       'rgba(34,197,94,0.025)',
    dragging:   'rgba(34,197,94,0.08)',
    processing: 'rgba(34,197,94,0.03)',
    done:       'rgba(34,197,94,0.04)',
    error:      'rgba(239,68,68,0.03)',
  }[displayState];

  return (
    <motion.div
      {...getRootProps()}
      animate={displayState === 'dragging' ? { scale: 1.02 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      style={{
        border: borderStyle,
        background: bgStyle,
        borderRadius: '1rem',
        position: 'relative',
        overflow: 'hidden',
        cursor: (state === 'processing' || state === 'done') ? 'default' : 'pointer',
        minHeight: 108,
        transition: 'border 0.2s ease, background 0.2s ease',
        userSelect: 'none',
      }}
    >
      <input {...getInputProps()} />

      {/* Processing: image bg + laser scan */}
      <AnimatePresence>
        {state === 'processing' && previewUrl && (
          <motion.div
            key="processing-bg"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Blurred image background */}
            <div
              style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${previewUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.35,
                filter: 'blur(1px)',
              }}
            />
            {/* Horizontal scanline texture */}
            <div
              style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(34,197,94,0.05) 0px, rgba(34,197,94,0.05) 1px, transparent 1px, transparent 3px)',
                pointerEvents: 'none',
              }}
            />
            {/* Green laser sweep line */}
            <motion.div
              style={{
                position: 'absolute', left: 0, right: 0,
                height: 2,
                background: 'linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.8) 20%, #22c55e 50%, rgba(34,197,94,0.8) 80%, transparent 100%)',
                boxShadow: '0 0 14px 3px rgba(34,197,94,0.55)',
                zIndex: 10,
              }}
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content overlay */}
      <div style={{ position: 'relative', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', gap: 8 }}>
        <AnimatePresence mode="wait">

          {/* IDLE */}
          {displayState === 'idle' && (
            <motion.div key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <Camera size={26} style={{ color: 'rgba(34,197,94,0.45)' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Drop anything</span>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-faint)', textAlign: 'center' }}>
                Whiteboard · Syllabus · Schedule · Screenshot
              </span>
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(34,197,94,0.55)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Upload size={9} />
                click to browse or drag here
              </span>
            </motion.div>
          )}

          {/* DRAGGING */}
          {displayState === 'dragging' && (
            <motion.div key="dragging"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>
                <Camera size={26} style={{ color: '#22c55e' }} />
              </motion.div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>Release to scan</span>
            </motion.div>
          )}

          {/* PROCESSING */}
          {state === 'processing' && (
            <motion.div key="processing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <WaveformAnimation />
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#22c55e' }}>
                AI scanning...
              </span>
            </motion.div>
          )}

          {/* DONE */}
          {state === 'done' && (
            <motion.div key="done"
              initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.25, 1] }}
                transition={{ duration: 0.45, ease: 'backOut' }}
                style={{ filter: 'drop-shadow(0 0 12px rgba(34,197,94,0.7))' }}
              >
                <CheckCircle2 size={28} style={{ color: '#22c55e' }} />
              </motion.div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
                {taskCount} task{taskCount !== 1 ? 's' : ''} extracted ✓
              </span>
            </motion.div>
          )}

          {/* ERROR */}
          {state === 'error' && (
            <motion.div key="error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <AlertTriangle size={22} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#f87171', textAlign: 'center', maxWidth: 220 }}>
                {errorMsg || 'Scan failed — try again'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setState('idle'); setErrorMsg(''); }}
                style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-faint)', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                Try again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ChaosScanner;
