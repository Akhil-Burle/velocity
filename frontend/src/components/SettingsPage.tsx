/**
 * SettingsPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * User settings page. Input/card/button patterns identical to existing
 * Dashboard patterns — no new visual styles introduced.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Clock, Mail, Bell, Moon, Zap, RefreshCw,
  CheckCircle2, ToggleLeft, ToggleRight, Palette, Calendar,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { fetchSettings, updateSettings } from '../api';
import type { Settings as SettingsType } from '../types';

// ── Toggle switch component — based on exact ToggleRight icon pattern ─────────
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label: string; desc?: string; isDark: boolean; accentColor?: string }> = ({ value, onChange, label, desc, isDark, accentColor = '#22c55e' }) => {
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const rgba = accentColor === '#22c55e' ? '34,197,94' : accentColor === '#f59e0b' ? '245,158,11' : '56,189,248';

  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex-1 pr-6">
        <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</div>
        {desc && <div className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--text-faint)' }}>{desc}</div>}
      </div>
      <motion.button
        onClick={() => onChange(!value)}
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0"
        style={{
          background: value ? `rgba(${rgba},0.1)` : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          border: value ? `1px solid rgba(${rgba},0.3)` : `1px solid ${surfaceBorder}`,
          color: value ? accentColor : 'var(--text-faint)',
        }}>
        {value ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
        <span>{value ? 'On' : 'Off'}</span>
      </motion.button>
    </div>
  );
};

// ── Text / time input — uses exact --input-bg / --input-border tokens ─────────
const FieldInput: React.FC<{ label: string; value: string; type?: string; onChange: (v: string) => void; placeholder?: string; isDark: boolean }> = ({ label, value, type = 'text', onChange, placeholder, isDark }) => {
  return (
    <div className="py-3.5">
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm font-mono px-4 py-2.5 rounded-xl outline-none transition-all"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.1)',
          color: 'var(--text-primary)', caretColor: '#22c55e',
        }}
      />
    </div>
  );
};

// ── Section card — same rounded-xl / surfaceBg / surfaceBorder as dashboard ───
const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; surfaceBg: string; surfaceBorder: string; divider: string }> = ({ icon, title, children, surfaceBg, surfaceBorder, divider }) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    className="rounded-xl overflow-hidden" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
    <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${divider}` }}>
      <span style={{ color: 'var(--text-faint)' }}>{icon}</span>
      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
    </div>
    <div className="px-5 divide-y" style={{ borderColor: divider }}>
      {children}
    </div>
  </motion.div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surfaceBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const divider       = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  useEffect(() => {
    fetchSettings()
      .then(s => setSettings(s))
      .catch(() => {
        // Use defaults if backend isn't running
        setSettings({
          preferredWorkStart: '09:00', preferredWorkEnd: '21:00',
          accountabilityEmail: '', dailyBriefingEnabled: true,
          dailyBriefingTime: '08:00', theme: isDark ? 'dark' : 'light',
          accentColor: '#22c55e', calendarSyncEnabled: false,
          notificationsEnabled: true, autoTriageEnabled: false,
        });
      });
  }, []);

  const patch = (updates: Partial<SettingsType>) => {
    setSettings(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError('Could not save — backend may not be running.'); setTimeout(() => setError(null), 3000); }
    finally { setSaving(false); }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-24">
        <motion.div className="w-8 h-8 rounded-full border-2 border-green-400 border-t-transparent"
          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 pb-16 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings size={11} style={{ color: 'var(--text-faint)' }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Preferences</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button onClick={handleSave} disabled={saving}
            whileHover={!saving ? { scale: 1.04, x: 2 } : {}} whileTap={!saving ? { scale: 0.96 } : {}}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              color: '#000',
              boxShadow: '0 0 20px rgba(34,197,94,0.25)',
              opacity: saving ? 0.7 : 1,
            }}>
            {saving
              ? <motion.div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
              : <CheckCircle2 size={14} />}
            {saved ? 'Saved!' : 'Save Changes'}
          </motion.button>
        </div>
      </div>

      <div className="space-y-4">

        {/* Work Hours */}
        <Section icon={<Clock size={13} />} title="Work Hours" surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider}>
          <div className="grid grid-cols-2 gap-4">
            <FieldInput label="Work Start" value={settings.preferredWorkStart} type="time"
              onChange={v => patch({ preferredWorkStart: v })} isDark={isDark} />
            <FieldInput label="Work End" value={settings.preferredWorkEnd} type="time"
              onChange={v => patch({ preferredWorkEnd: v })} isDark={isDark} />
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={<Bell size={13} />} title="Notifications" surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider}>
          <Toggle value={settings.notificationsEnabled}
            onChange={v => patch({ notificationsEnabled: v })}
            label="Notifications" desc="Context-aware reminders for deadlines, habits, and check-ins"
            isDark={isDark} />
          <Toggle value={settings.dailyBriefingEnabled}
            onChange={v => patch({ dailyBriefingEnabled: v })}
            label="Daily Briefing" desc="AI-generated morning summary of your priorities"
            isDark={isDark} />
          {settings.dailyBriefingEnabled && (
            <FieldInput label="Briefing Time" value={settings.dailyBriefingTime} type="time"
              onChange={v => patch({ dailyBriefingTime: v })} isDark={isDark} />
          )}
          <FieldInput label="Accountability Email" value={settings.accountabilityEmail}
            type="email" placeholder="you@example.com"
            onChange={v => patch({ accountabilityEmail: v })} isDark={isDark} />
        </Section>

        {/* AI Features */}
        <Section icon={<Zap size={13} />} title="AI Features" surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider}>
          <Toggle value={settings.autoTriageEnabled}
            onChange={v => patch({ autoTriageEnabled: v })}
            label="Auto-Triage" desc="Automatically reschedule low-priority tasks when you're overloaded"
            isDark={isDark} accentColor="#f59e0b" />
          <Toggle value={settings.calendarSyncEnabled}
            onChange={v => patch({ calendarSyncEnabled: v })}
            label="Google Calendar Sync" desc="Push scheduled subtask blocks to your calendar"
            isDark={isDark} accentColor="#38bdf8" />
        </Section>

        {/* Appearance */}
        <Section icon={<Palette size={13} />} title="Appearance" surfaceBg={surfaceBg} surfaceBorder={surfaceBorder} divider={divider}>
          <div className="py-3.5">
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Theme</div>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map(t => (
                <motion.button key={t} onClick={() => { patch({ theme: t }); if ((t === 'dark') !== isDark) toggle(); }}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold capitalize"
                  style={{
                    background: settings.theme === t
                      ? (isDark ? 'rgba(253,224,71,0.08)' : 'rgba(15,23,42,0.07)')
                      : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                    border: settings.theme === t
                      ? (isDark ? '1px solid rgba(253,224,71,0.2)' : '1px solid rgba(15,23,42,0.14)')
                      : `1px solid ${surfaceBorder}`,
                    color: settings.theme === t
                      ? (isDark ? '#fde047' : '#334155')
                      : 'var(--text-faint)',
                  }}>
                  {t === 'dark' ? <Moon size={13} /> : <Settings size={13} />}
                  {t}
                </motion.button>
              ))}
            </div>
          </div>
        </Section>

        {/* About */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-xl p-4 flex items-center justify-between"
          style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <Zap size={14} className="text-green-400" />
            </div>
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Velocity</div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>v2.0.0 · AI-powered productivity</div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
            Online
          </span>
        </motion.div>
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span className="text-xs font-mono text-red-400">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
