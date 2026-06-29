/**
 * TourContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for the unified Guided Tour system.
 *
 * Shared across:
 *  - StartHereCard (table of contents / entry point)
 *  - ContextualHints (page-aware floating hints)
 *  - TourReOpenButton (persistent re-open affordance)
 *
 * Session persistence: uses sessionStorage so state resets on a fresh login
 * but survives page navigations within the same session.
 *
 * Design principles enforced here:
 *  - Per-highlight dismissal (not a single global "done" flag)
 *  - Shared "highlights seen" set between card and hints
 *  - No forced sequence — each highlight is independent
 *  - Card can be dismissed/reopened independently of individual highlights
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ─── Highlight definition ─────────────────────────────────────────────────────
export interface TourHighlight {
  id: string;
  title: string;
  hint: string;
  route: string;
  target: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  color: string;
  cardDesc: string;
  iconKey: string;
  linkTo: string;
  deepLinkKey?: string;
  deepLinkValue?: string;
  /** If true, this entry appears in the Start Here card but never fires a hint tooltip */
  cardOnly?: boolean;
}

// ─── The canonical ordered highlights list ────────────────────────────────────
// Order determines priority in the card and tour. Agent Log first — always.
export const TOUR_HIGHLIGHTS: TourHighlight[] = [
  {
    id: 'agent-log',
    title: 'Agent Activity Log',
    hint: "This happened without anyone clicking a button — tap any entry to see the full reasoning chain behind each autonomous decision.",
    route: '/agent-log',
    target: 'tour-agent-log-page-header',
    placement: 'bottom',
    color: '#22c55e',
    cardDesc: 'Every autonomous AI action, timestamped with reasoning',
    iconKey: 'bot',
    linkTo: '/agent-log',
  },
  {
    id: 'behavioral-drift',
    title: 'Behavioral Drift Score',
    hint: "The gap between what you say you've done and what your behavior actually shows — expand any task row to see which signals are pulling it down.",
    route: '/velocity-vector',
    target: 'tour-drift-section',
    placement: 'bottom',
    color: '#ef4444',
    cardDesc: 'Claimed vs. real progress — the gap that drives every intervention',
    iconKey: 'trending-down',
    linkTo: '/velocity-vector',
  },
  {
    id: 'velocity-vector',
    title: 'Velocity Vector',
    hint: "This is why it's called Velocity — speed AND direction in one view. A high magnitude with poor alignment means you're moving fast but drifting off course.",
    route: '/velocity-vector',
    target: 'tour-vector-arrow',
    placement: 'right',
    color: '#a78bfa',
    cardDesc: "Speed + direction in one view — why it's named Velocity",
    iconKey: 'activity',
    linkTo: '/velocity-vector',
  },
  {
    id: 'omnibar',
    title: 'OmniBar',
    hint: "Type anything here — 'I'm behind on everything' — and it routes to the right action automatically. The AI decides, not you.",
    route: '/dashboard',
    target: 'tour-omni',
    placement: 'bottom',
    color: '#22c55e',
    cardDesc: 'Plain-English commands → real actions, routed by AI',
    iconKey: 'zap',
    linkTo: '/dashboard',
    cardOnly: true,
  },
  {
    id: 'panic-mode',
    title: 'Panic Mode',
    hint: '',
    route: '/dashboard',
    target: '',
    placement: 'top',
    color: '#ef4444',
    cardDesc: 'One click → rescue checklist + code + GitHub repo, autonomously',
    iconKey: 'shield-alert',
    linkTo: '/dashboard',
    cardOnly: true,
  },
  {
    id: 'command-day',
    title: 'Command Day',
    hint: "That 'AUTONOMOUS' banner at the top wasn't triggered by a button — Command Day detected critical tasks on load and rebalanced your schedule automatically.",
    route: '/command',
    target: 'tour-command-day-rebalance',
    placement: 'bottom',
    color: '#38bdf8',
    cardDesc: 'Auto-rebalanced your day before you even clicked anything',
    iconKey: 'calendar',
    linkTo: '/command',
  },
  {
    id: 'agent-memory',
    title: 'Adaptive Policy Memory',
    hint: "Cancel the same autonomous action 3 times and the agent writes a policy and stops proposing it. This is how Velocity learns your preferences without being told.",
    route: '/agent-log',
    target: 'tour-agent-memory-tab',
    placement: 'bottom',
    color: '#ec4899',
    cardDesc: 'The agent learns from your cancellations and adapts its behavior',
    iconKey: 'flask',
    deepLinkKey: 'agent_log_tab',
    deepLinkValue: 'memory',
    linkTo: '/agent-log',
  },
  {
    id: 'tech-stack',
    title: 'Tech Stack',
    hint: "Every entry here is live and wired in — hover any item to see the exact Velocity feature it powers. No placeholder logos.",
    route: '/tech-stack',
    target: 'tour-tech-stack-header',
    placement: 'bottom',
    color: '#4285f4',
    cardDesc: 'Every Google API confirmed live with the feature it powers',
    iconKey: 'layers',
    linkTo: '/tech-stack',
  },
];

// ─── Storage keys ─────────────────────────────────────────────────────────────
const CARD_KEY    = 'tour_card_dismissed_v3';
const SEEN_PREFIX = 'tour_seen_v3_'; // + highlight.id

function getSeenSet(): Set<string> {
  const out = new Set<string>();
  TOUR_HIGHLIGHTS.forEach(h => {
    if (sessionStorage.getItem(SEEN_PREFIX + h.id)) out.add(h.id);
  });
  return out;
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface TourContextValue {
  highlights: TourHighlight[];
  seenIds: Set<string>;
  cardVisible: boolean;
  /** Mark a highlight as seen — called when its hint is shown or its page is visited */
  markSeen: (id: string) => void;
  /** Dismiss the Start Here card (hide it, but it can be re-opened) */
  dismissCard: () => void;
  /** Re-open the Start Here card (e.g., from TourReOpenButton) */
  openCard: () => void;
  /** How many highlights have been seen */
  seenCount: number;
  /** Total highlights */
  totalCount: number;
}

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenSet);
  const [cardVisible, setCardVisible] = useState(() => !sessionStorage.getItem(CARD_KEY));

  // Sync seenIds to sessionStorage whenever it changes
  const markSeen = useCallback((id: string) => {
    sessionStorage.setItem(SEEN_PREFIX + id, 'true');
    setSeenIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const dismissCard = useCallback(() => {
    sessionStorage.setItem(CARD_KEY, 'true');
    setCardVisible(false);
  }, []);

  const openCard = useCallback(() => {
    // Re-opening does NOT reset the seen state — it just shows the card again
    sessionStorage.removeItem(CARD_KEY);
    setCardVisible(true);
  }, []);

  return (
    <TourContext.Provider value={{
      highlights: TOUR_HIGHLIGHTS,
      seenIds,
      cardVisible,
      markSeen,
      dismissCard,
      openCard,
      seenCount: seenIds.size,
      totalCount: TOUR_HIGHLIGHTS.filter(h => !h.cardOnly).length,
    }}>
      {children}
    </TourContext.Provider>
  );
};

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
