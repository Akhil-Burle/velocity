/**
 * CreditsContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global Velocity Credits state. Powers the persistent header ticker and lets
 * any component award credits with a single call. Awards optimistically bump
 * the local balance, fire a burst event for the ticker animation, then reconcile
 * with the server response.
 *
 * Usage:
 *   const { profile, award } = useCredits();
 *   award('task_complete');           // server-defined amount
 *   award('ai_tool_use', 2);          // explicit amount
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { fetchVelocityProfile, awardCredits as apiAward } from './api';
import { useAuth } from './AuthContext';
import type { VelocityProfile } from './types';

interface BurstEvent {
  id: number;
  amount: number;
  label: string;
}

interface CreditsContextValue {
  profile: VelocityProfile | null;
  loading: boolean;
  /** Latest award burst — the ticker watches this to animate +VC. */
  burst: BurstEvent | null;
  /** Set true briefly when a level-up happens, for celebratory UI. */
  leveledUp: boolean;
  refresh: () => Promise<void>;
  award: (action: string, amount?: number) => Promise<void>;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [profile, setProfile] = useState<VelocityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [burst, setBurst] = useState<BurstEvent | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);
  const burstId = useRef(0);
  const prevLevel = useRef<number | null>(null);
  // De-dupe rapid identical awards (e.g. double-fired handlers)
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const p = await fetchVelocityProfile();
      setProfile(p);
      prevLevel.current = p.level;
    } catch {
      // backend may be offline — ticker simply stays hidden
    } finally {
      setLoading(false);
    }
  }, []);

  // Load profile once we have an auth token
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    refresh();
  }, [token, refresh]);

  const award = useCallback(async (action: string, amount?: number) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const updated = await apiAward(action, amount);
      // Burst animation from the server-confirmed award
      if (updated.awarded) {
        burstId.current += 1;
        setBurst({ id: burstId.current, amount: updated.awarded.amount, label: updated.awarded.label });
      }
      // Level-up detection
      if (prevLevel.current !== null && updated.level > prevLevel.current) {
        setLeveledUp(true);
        setTimeout(() => setLeveledUp(false), 4200);
      }
      prevLevel.current = updated.level;
      setProfile(updated);
    } catch {
      // silently ignore — awarding is non-critical
    } finally {
      inFlight.current = false;
    }
  }, []);

  return (
    <CreditsContext.Provider value={{ profile, loading, burst, leveledUp, refresh, award }}>
      {children}
    </CreditsContext.Provider>
  );
};

export function useCredits(): CreditsContextValue {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error('useCredits must be used within CreditsProvider');
  return ctx;
}

export default CreditsContext;
