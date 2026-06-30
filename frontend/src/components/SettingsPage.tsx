/**
 * SettingsPage.tsx — Full-page rebuild.
 * Two-column layout: sticky sidebar nav + scrollable content area.
 * Covers the full viewport, premium feel consistent with TechStackPage.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Bell, Zap, Palette, LogOut, Sun, Moon, User,
  CheckCircle2, ToggleLeft, ToggleRight, Mail, Calendar,
  Shield, ChevronRight, Save, AlertCircle, Cpu,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { fetchSettings, updateSettings, setApiToken } from '../api';
import type { Settings as SettingsType } from '../types';

// ── Sidebar nav items ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'profile',       icon: User,     label: 'Profile',       desc: 'Account & session' },
  { id: 'schedule',      icon: Clock,    label: 'Schedule',      desc: 'Work hours' },
  { id: 'notifications', icon: Bell,     label: 'Notifications', desc: 'Alerts & briefings' },
  { id: 'ai',            icon: Cpu,      label: 'AI Features',   desc: 'Automation & triage' },
  { id: 'integrations',  icon: Calendar, label: 'Integrations',  desc: 'Calendar & email' },
  { id: 'appearance',    icon: Palette,  label: 'Appearance',    desc: 'Theme & display' },
] as const;

type SectionId = typeof NAV_ITEMS[number]['id'];

// ── Toggle ────────────────────────────────────────────────────────────────────
const Toggle: React.FC<{
  value: boolean; onChange: (v: boolean) => void;
  accent?: string;
}> = ({ value, onChange, accent = '#22c55e' }) => {
  const rgb = accent === '#22c55e' ? '34,197,94'
    : accent === '#f59e0b' ? '245,158,11'
    : accent === '#38bdf8' ? '56,189,248'
    : '34,197,94';
  return (
    <motion.button
      onClick={() => onChange(!value)}
      whileTap={{ scale: 0.92 }}
      className="relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200"
      style={{
        background: value ? `rgba(${rgb},0.9)` : 'var(--bg-surface-md)',
        border: value ? `1px solid rgba(${rgb},0.5)` : '1px solid var(--border-subtle)',
        boxShadow: value ? `0 0 12px rgba(${rgb},0.35)` : 'none',
      }}
    >
      <motion.div
        className="absolute top-0.5 w-5 h-5 rounded-full"
        style={{ background: value ? '#000' : 'var(--text-faint)' }}
        animate={{ left: value ? '22px' : '2px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </motion.button>
  );
};

// ── Setting row — label + description + control ───────────────────────────────
const SettingRow: React.FC<{
  label: string; desc?: string; children: React.ReactNode; last?: boolean;
}> = ({ label, desc, children, last }) => (
  <div
    className="flex items-center justify-between gap-6 py-4"
    style={{ borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}
  >
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</div>
      {desc && <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>{desc}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

// ── Section card wrapper ──────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    className={`rounded-2xl overflow-hidden ${className}`}
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    {children}
  </div>
);

const CardHeader: React.FC<{
  icon: React.ReactNode; title: string; subtitle?: string; accent?: string;
}> = ({ icon, title, subtitle, accent = '#22c55e' }) => (
  <div
    className="px-6 py-4 flex items-center gap-3"
    style={{ borderBottom: '1px solid var(--border-subtle)' }}
  >
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: `${accent}14`, border: `1px solid ${accent}28`, color: accent }}
    >
      {icon}
    </div>
    <div>
      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</div>
      {subtitle && <div className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>{subtitle}</div>}
    </div>
  </div>
);

// ── Time input ────────────────────────────────────────────────────────────────
const TimeInput: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</label>
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-4 py-2.5 rounded-xl text-sm font-mono outline-none w-36"
      style={{
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        color: 'var(--text-primary)',
        caretColor: '#22c55e',
      }}
    />
  </div>
);

// ── Text input ────────────────────────────────────────────────────────────────
const TextInput: React.FC<{
  type?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}> = ({ type = 'text', value, onChange, placeholder }) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="px-4 py-2.5 rounded-xl text-sm font-mono outline-none transition-all w-full max-w-xs"
    style={{
      background: 'var(--input-bg)',
      border: '1px solid var(--input-border)',
      color: 'var(--text-primary)',
      caretColor: '#22c55e',
    }}
  />
);

// ── Main component ────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const DEFAULTS: SettingsType = {
    preferredWorkStart: '09:00', preferredWorkEnd: '21:00',
    accountabilityEmail: '', dailyBriefingEnabled: true,
    dailyBriefingTime: '08:00', theme: isDark ? 'dark' : 'light',
    accentColor: '#22c55e', calendarSyncEnabled: false,
    notificationsEnabled: true, autoTriageEnabled: false,
  };

  useEffect(() => {
    fetchSettings().then(s => setSettings(s)).catch(() => setSettings(DEFAULTS));
  }, []);

  const patch = (updates: Partial<SettingsType>) =>
    setSettings(prev => prev ? { ...prev, ...updates } : null);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Could not save — backend may be offline.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    setApiToken(null);
    navigate('/');
  };

  const scrollTo = (id: SectionId) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Update active nav based on scroll
  useEffect(() => {
    const container = document.getElementById('settings-scroll');
    if (!container) return;
    const handler = () => {
      for (const item of [...NAV_ITEMS].reverse()) {
        const el = sectionRefs.current[item.id];
        if (el && el.getBoundingClientRect().top <= 160) {
          setActiveSection(item.id);
          break;
        }
      }
    };
    container.addEventListener('scroll', handler, { passive: true });
    return () => container.removeEventListener('scroll', handler);
  }, []);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <motion.div className="w-8 h-8 rounded-full border-2 border-green-400 border-t-transparent"
          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-64 shrink-0 h-full overflow-y-auto py-6 px-4"
        style={{ borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}
      >
        {/* Page title */}
        <div className="px-3 mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>
            Settings
          </p>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Preferences</h1>
          <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-faint)' }}>
            Manage your Velocity workspace
          </p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left w-full transition-all"
                style={{
                  background: active ? 'rgba(34,197,94,0.08)' : 'transparent',
                  border: active ? '1px solid rgba(34,197,94,0.2)' : '1px solid transparent',
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: active ? 'rgba(34,197,94,0.15)' : 'var(--bg-surface)',
                    color: active ? '#22c55e' : 'var(--text-faint)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: active ? '#22c55e' : 'var(--text-secondary)' }}>
                    {item.label}
                  </div>
                  <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-faint)' }}>
                    {item.desc}
                  </div>
                </div>
                {active && <ChevronRight size={12} style={{ color: '#22c55e' }} />}
              </motion.button>
            );
          })}
        </nav>

        {/* Save button in sidebar */}
        <div className="mt-6 px-1">
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileHover={!saving ? { scale: 1.02 } : {}}
            whileTap={!saving ? { scale: 0.97 } : {}}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: '#000',
              boxShadow: '0 0 20px rgba(34,197,94,0.25)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? <motion.div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
              : saved
              ? <CheckCircle2 size={15} />
              : <Save size={15} />
            }
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </motion.button>
        </div>
      </aside>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <main
        id="settings-scroll"
        className="flex-1 overflow-y-auto py-6 px-4 sm:px-8"
      >
        {/* Mobile save bar */}
        <div className="lg:hidden flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Preferences</h1>
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: '#000',
              boxShadow: '0 0 16px rgba(34,197,94,0.25)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save'}
          </motion.button>
        </div>

        <div className="max-w-2xl space-y-8 pb-20">

          {/* ── Profile & Session ─────────────────────────────────────────── */}
          <div ref={el => { sectionRefs.current['profile'] = el; }}>
            <SectionLabel>Profile & Session</SectionLabel>
            <div className="space-y-4">

              {/* Account card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card>
                  <CardHeader icon={<User size={14} />} title="Account" subtitle="Your active session" accent="#22c55e" />
                  <div className="px-6 py-5">
                    <div
                      className="flex items-center gap-4 p-4 rounded-xl mb-4"
                      style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border-subtle)' }}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
                        style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}
                      >
                        V
                      </div>
                      <div>
                        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Velocity User</div>
                        <div className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>Demo session · JWT auth</div>
                        <div className="mt-1">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                            ● Active
                          </span>
                        </div>
                      </div>
                    </div>

                    <SettingRow
                      label="Sign out"
                      desc="Clears your session token and returns to the landing page"
                      last
                    >
                      <motion.button
                        onClick={handleLogout}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                      >
                        <LogOut size={13} />
                        Log out
                      </motion.button>
                    </SettingRow>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* ── Schedule ──────────────────────────────────────────────────── */}
          <div ref={el => { sectionRefs.current['schedule'] = el; }}>
            <SectionLabel>Schedule</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card>
                <CardHeader icon={<Clock size={14} />} title="Work Hours" subtitle="Defines your daily focus window for scheduling and capacity" accent="#38bdf8" />
                <div className="px-6 py-5">
                  <p className="text-xs font-mono mb-5" style={{ color: 'var(--text-faint)' }}>
                    Command Day and AI Rebalance use these hours to schedule focus blocks and calculate capacity load.
                  </p>
                  <div className="flex flex-wrap gap-6">
                    <TimeInput label="Work Start" value={settings.preferredWorkStart} onChange={v => patch({ preferredWorkStart: v })} />
                    <TimeInput label="Work End"   value={settings.preferredWorkEnd}   onChange={v => patch({ preferredWorkEnd: v })} />
                  </div>

                  {/* Visual work window bar */}
                  <div className="mt-5">
                    <div className="flex justify-between text-[10px] font-mono mb-1.5" style={{ color: 'var(--text-faint)' }}>
                      <span>00:00</span><span>12:00</span><span>24:00</span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-md)' }}>
                      {(() => {
                        const toMins = (t: string) => {
                          const [h, m] = t.split(':').map(Number);
                          return h * 60 + (m || 0);
                        };
                        const start = toMins(settings.preferredWorkStart) / (24 * 60) * 100;
                        const end   = toMins(settings.preferredWorkEnd)   / (24 * 60) * 100;
                        return (
                          <div
                            className="absolute h-full rounded-full"
                            style={{
                              left: `${start}%`,
                              width: `${Math.max(end - start, 0)}%`,
                              background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
                              boxShadow: '0 0 8px rgba(56,189,248,0.4)',
                            }}
                          />
                        );
                      })()}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono mt-1.5" style={{ color: 'var(--text-faint)' }}>
                      <span style={{ color: '#38bdf8' }}>{settings.preferredWorkStart}</span>
                      <span style={{ color: '#22c55e' }}>{settings.preferredWorkEnd}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* ── Notifications ────────────────────────────────────────────── */}
          <div ref={el => { sectionRefs.current['notifications'] = el; }}>
            <SectionLabel>Notifications</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card>
                <CardHeader icon={<Bell size={14} />} title="Alerts & Briefings" subtitle="Control when and how Velocity reaches out" accent="#f59e0b" />
                <div className="px-6 py-2">
                  <SettingRow label="Push Notifications" desc="Deadline warnings, habit reminders, and status changes">
                    <Toggle value={settings.notificationsEnabled} onChange={v => patch({ notificationsEnabled: v })} accent="#22c55e" />
                  </SettingRow>
                  <SettingRow label="Daily Briefing" desc="AI-generated morning summary of today's priorities and risks">
                    <Toggle value={settings.dailyBriefingEnabled} onChange={v => patch({ dailyBriefingEnabled: v })} accent="#f59e0b" />
                  </SettingRow>
                  <AnimatePresence>
                    {settings.dailyBriefingEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden', borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <div className="py-4">
                          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                            Briefing Time
                          </div>
                          <TimeInput label="" value={settings.dailyBriefingTime} onChange={v => patch({ dailyBriefingTime: v })} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <SettingRow label="Accountability Email" desc="Receive weekly progress reports to your inbox" last>
                    <TextInput type="email" value={settings.accountabilityEmail} onChange={v => patch({ accountabilityEmail: v })} placeholder="you@example.com" />
                  </SettingRow>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* ── AI Features ───────────────────────────────────────────────── */}
          <div ref={el => { sectionRefs.current['ai'] = el; }}>
            <SectionLabel>AI Features</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card>
                <CardHeader icon={<Cpu size={14} />} title="Automation & Intelligence" subtitle="Powered by Gemini 3.1 Flash Lite via Vertex AI" accent="#a78bfa" />
                <div className="px-6 py-2">
                  <SettingRow
                    label="Auto-Triage"
                    desc="Automatically deprioritize low-value tasks when your workload exceeds capacity"
                  >
                    <Toggle value={settings.autoTriageEnabled} onChange={v => patch({ autoTriageEnabled: v })} accent="#f59e0b" />
                  </SettingRow>
                  <SettingRow
                    label="Behavioral Drift Detection"
                    desc="Infer real progress from check-in patterns, not just self-reports"
                    last
                  >
                    <Toggle value={true} onChange={() => {}} accent="#a78bfa" />
                  </SettingRow>
                </div>
                {/* AI model info footer */}
                <div
                  className="px-6 py-3 flex items-center gap-2"
                  style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(167,139,250,0.04)' }}
                >
                  <Cpu size={11} style={{ color: '#a78bfa' }} />
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    Model: <span style={{ color: '#a78bfa' }}>gemini-3.1-flash-lite</span> · Vertex AI · velocity-500511
                  </span>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* ── Integrations ──────────────────────────────────────────────── */}
          <div ref={el => { sectionRefs.current['integrations'] = el; }}>
            <SectionLabel>Integrations</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card>
                <CardHeader icon={<Calendar size={14} />} title="Calendar & Email" subtitle="Connect external services" accent="#34a853" />
                <div className="px-6 py-2">
                  <SettingRow
                    label="Google Calendar Sync"
                    desc="Push scheduled subtask blocks to your Google Calendar as events"
                  >
                    <Toggle value={settings.calendarSyncEnabled} onChange={v => patch({ calendarSyncEnabled: v })} accent="#38bdf8" />
                  </SettingRow>
                  <SettingRow
                    label="Accountability Email"
                    desc="Send weekly velocity reports to a chosen address"
                    last
                  >
                    <TextInput type="email" value={settings.accountabilityEmail} onChange={v => patch({ accountabilityEmail: v })} placeholder="you@example.com" />
                  </SettingRow>
                </div>
                <div
                  className="px-6 py-3 flex items-center gap-2"
                  style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(52,168,83,0.04)' }}
                >
                  <Shield size={11} style={{ color: '#34a853' }} />
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    Google OAuth 2.0 · Calendar API v3 · credentials stored in Cloud Secret Manager
                  </span>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* ── Appearance ────────────────────────────────────────────────── */}
          <div ref={el => { sectionRefs.current['appearance'] = el; }}>
            <SectionLabel>Appearance</SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card>
                <CardHeader icon={<Palette size={14} />} title="Theme & Display" subtitle="Choose how Velocity looks" accent="#818cf8" />
                <div className="px-6 py-5">
                  <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>
                    Color Theme
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'dark',  icon: Moon, label: 'Dark',  sub: 'Recommended', accent: '#818cf8' },
                      { value: 'light', icon: Sun,  label: 'Light', sub: 'High contrast', accent: '#f59e0b' },
                    ] as const).map(opt => {
                      const Icon = opt.icon;
                      const active = settings.theme === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          onClick={() => {
                            patch({ theme: opt.value });
                            if ((opt.value === 'dark') !== isDark) toggle();
                          }}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          className="relative flex flex-col items-start gap-2 p-4 rounded-xl text-left overflow-hidden"
                          style={{
                            background: active
                              ? `${opt.accent}10`
                              : 'var(--bg-surface-md)',
                            border: active
                              ? `1.5px solid ${opt.accent}40`
                              : '1px solid var(--border-subtle)',
                          }}
                        >
                          {/* Theme preview swatch */}
                          <div
                            className="w-full h-12 rounded-lg overflow-hidden mb-1"
                            style={{
                              background: opt.value === 'dark'
                                ? 'linear-gradient(135deg, #0d1117 0%, #141b23 100%)'
                                : 'linear-gradient(135deg, #f1f5f9 0%, #ffffff 100%)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div className="flex gap-1 p-2">
                              {['#ef4444','#f59e0b','#22c55e'].map(c => (
                                <div key={c} className="w-2 h-2 rounded-full" style={{ background: c, opacity: 0.8 }} />
                              ))}
                            </div>
                            <div className="flex gap-1 px-2">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="h-1.5 rounded-full"
                                  style={{
                                    width: `${30 + i * 12}%`,
                                    background: opt.value === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Icon size={13} style={{ color: active ? opt.accent : 'var(--text-faint)' }} />
                            <span className="text-sm font-semibold" style={{ color: active ? opt.accent : 'var(--text-secondary)' }}>
                              {opt.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{opt.sub}</span>
                          {active && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 size={14} style={{ color: opt.accent }} />
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* ── About / version footer ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-between px-5 py-4 rounded-2xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <Zap size={14} style={{ color: '#22c55e' }} />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Velocity</div>
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  Google AI Hackathon 2026 · gemini-3.1-flash-lite
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.span className="w-2 h-2 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                Online
              </span>
            </div>
          </motion.div>

        </div>
      </main>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 10, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl"
            style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', backdropFilter: 'blur(16px)' }}
          >
            <AlertCircle size={14} style={{ color: '#f87171' }} />
            <span className="text-sm font-mono" style={{ color: '#f87171' }}>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3 mb-3">
    <span className="text-[10px] font-mono uppercase tracking-widest font-semibold" style={{ color: 'var(--text-faint)' }}>
      {children}
    </span>
    <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
  </div>
);

export default SettingsPage;
