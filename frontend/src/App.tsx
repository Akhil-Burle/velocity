import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider, useAuth, IS_DEMO_MODE } from './AuthContext';
import { CreditsProvider } from './CreditsContext';
import { MotionProvider, useMotionPreference } from './MotionContext';
import { setApiToken } from './api';
import AppShell from './components/AppShell';
import Dashboard from './components/Dashboard';
import LandingPage from './components/landing/LandingPage';
import GoalsPage from './components/GoalsPage';
import CalendarPage from './components/CalendarPage';
import InsightsPage from './components/InsightsPage';
import SettingsPage from './components/SettingsPage';
import CommandDay from './components/CommandDay';
import AgentLogPage from './components/AgentLogPage';
import TechStackPage from './components/TechStackPage';
import VelocityVectorPage from './components/VelocityVectorPage';
import ApiDocsPage from './components/ApiDocsPage';
import { ToastProvider } from './components/Toast';
import { TourProvider } from './components/TourContext';
import { Zap } from 'lucide-react';

const fullPageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } },
};

const litePageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
};

const ShellPage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const reducedMotion = useMotionPreference();
  const variants = reducedMotion ? litePageVariants : fullPageVariants;
  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <motion.div key={window.location.pathname} variants={variants} initial="initial" animate="animate" exit="exit">
          {children}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
};

// ── Demo splash — shown for ~600ms while auto guest-login resolves ─────────────
const DemoSplash: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.25 }}
    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5"
    style={{ background: 'linear-gradient(145deg,#0d1117 0%,#111820 50%,#0d1117 100%)' }}
  >
    <motion.div
      className="w-16 h-16 rounded-2xl flex items-center justify-center"
      style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}
      animate={{ boxShadow: ['0 0 30px rgba(34,197,94,0.1)', '0 0 60px rgba(34,197,94,0.2)', '0 0 30px rgba(34,197,94,0.1)'] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <Zap size={28} className="text-green-400" />
    </motion.div>
    <div className="text-center">
      <p className="text-sm font-semibold text-white mb-1">Velocity</p>
      <p className="text-xs font-mono" style={{ color: '#4b5563' }}>Loading demo...</p>
    </div>
    <motion.div className="w-40 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <motion.div className="h-full rounded-full bg-green-400"
        initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
    </motion.div>
  </motion.div>
);

// ── Inner app — has access to AuthContext ──────────────────────────────────────
function AppInner() {
  const { token, autoAuthReady, setAuth } = useAuth();

  // Sync token into api.ts module-level variable whenever it changes
  useEffect(() => {
    setApiToken(token);
  }, [token]);

  // Handle Google Sign-In callback redirect (?google_token=...&mode=google)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get('google_token');
    const mode = params.get('mode');
    if (googleToken && mode === 'google') {
      setApiToken(googleToken);
      // Extract userId from JWT payload (base64 decode middle segment)
      try {
        const payload = JSON.parse(atob(googleToken.split('.')[1]));
        setAuth(googleToken, payload.userId || payload.sub, 'google');
      } catch {
        setAuth(googleToken, 'google_user', 'google');
      }
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
    const authError = params.get('auth_error');
    if (authError) {
      console.warn('[App] Google auth error:', authError);
      window.history.replaceState({}, '', '/');
    }
  }, [setAuth]);

  // Demo mode: show splash until auto-auth resolves, then go straight to dashboard
  if (IS_DEMO_MODE && !autoAuthReady) {
    return (
      <AnimatePresence>
        <DemoSplash key="splash" />
      </AnimatePresence>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — skip entirely in demo mode or if already authenticated */}
        <Route path="/" element={
          IS_DEMO_MODE
            ? <Navigate to="/dashboard" replace />
            : token
              ? <Navigate to="/dashboard" replace />
              : <LandingPage />
        } />

        {/* App pages — all inside AppShell */}
        <Route path="/dashboard" element={
          <ShellPage><Dashboard /></ShellPage>
        } />
        <Route path="/command" element={
          <ShellPage><CommandDay /></ShellPage>
        } />
        <Route path="/goals" element={
          <ShellPage><GoalsPage /></ShellPage>
        } />
        <Route path="/calendar" element={
          <ShellPage><CalendarPage /></ShellPage>
        } />
        <Route path="/insights" element={
          <ShellPage><InsightsPage /></ShellPage>
        } />
        <Route path="/settings" element={
          <ShellPage><SettingsPage /></ShellPage>
        } />
        <Route path="/agent-log" element={
          <ShellPage><AgentLogPage /></ShellPage>
        } />
        <Route path="/tech-stack" element={
          <ShellPage><TechStackPage /></ShellPage>
        } />
        <Route path="/velocity-vector" element={
          <ShellPage><VelocityVectorPage /></ShellPage>
        } />
        <Route path="/api-docs" element={
          <ShellPage><ApiDocsPage /></ShellPage>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <MotionProvider>
      <ThemeProvider>
        <AuthProvider>
          <CreditsProvider>
            <ToastProvider>
              <TourProvider>
                <AppInner />
              </TourProvider>
            </ToastProvider>
          </CreditsProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionProvider>
  );
}

export default App;
