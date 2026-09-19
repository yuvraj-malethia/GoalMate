/** UI preferences and transient UI state (theme, accent, palette, sidebar). */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUi = create()(
  persist(
    (set) => ({
      theme: 'system',
      accent: 'blue',
      paletteOpen: false,
      sidebarOpen: false,
      newGoalOpen: false,
      aiPrefill: '',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      setAccent: (accent) => {
        set({ accent });
        document.documentElement.dataset.accent = accent;
      },
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      openNewGoal: (mode, prefill = '') => set({ newGoalOpen: mode, aiPrefill: prefill, paletteOpen: false }),
      closeNewGoal: () => set({ newGoalOpen: false }),
    }),
    {
      name: 'goalmate-ui',
      partialize: (s) => ({ theme: s.theme, accent: s.accent }),
    },
  ),
);

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function resolvedDark(theme) {
  return theme === 'dark' || (theme === 'system' && media.matches);
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', resolvedDark(theme));
}

media.addEventListener('change', () => applyTheme(useUi.getState().theme));

/** Reactive "is the app currently dark?" (theme setting + OS preference). */
export function useIsDark() {
  const theme = useUi((s) => s.theme);
  const [systemDark, setSystemDark] = useState(media.matches);
  useEffect(() => {
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return theme === 'dark' || (theme === 'system' && systemDark);
}
