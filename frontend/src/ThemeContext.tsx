import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggle: (originX?: number, originY?: number) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

const WIPE_DURATION = 500; // ms — total animation length
const THEME_FLIP_AT = 240; // ms — flip exactly at mid-wipe when panel covers most of screen

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('velocity-theme') as Theme) || 'dark'; }
    catch { return 'dark'; }
  });

  const panelRef = useRef<HTMLDivElement | null>(null);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('velocity-theme', theme); } catch {}
  }, [theme]);

  const toggle = useCallback((_originX?: number, _originY?: number) => {
    // Cancel any in-flight animation
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (panelRef.current) { panelRef.current.remove(); panelRef.current = null; }

    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

    // Build the wipe panel
    const panel = document.createElement('div');
    panel.className = `theme-wipe theme-wipe--${nextTheme}`;
    document.body.appendChild(panel);
    panelRef.current = panel;

    // Force reflow so the starting transform is painted before the class fires
    void panel.offsetWidth;
    panel.classList.add('theme-wipe--active');

    // Flip the actual theme at mid-wipe, then immediately kick the panel off to the left
    timers.current.push(setTimeout(() => {
      setTheme(nextTheme);
      // Small rAF delay so React re-renders before we start the exit slide
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (panel.isConnected) panel.classList.add('theme-wipe--exit');
        });
      });
    }, THEME_FLIP_AT));

    // Remove panel after animation fully completes
    timers.current.push(setTimeout(() => {
      panel.remove();
      if (panelRef.current === panel) panelRef.current = null;
    }, WIPE_DURATION + 60));
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};
