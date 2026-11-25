/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/sqlite-simulation.ts';
import { getThemeClasses } from '../utils/pureLogic.ts';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (enabled: boolean) => void;
  theme: ReturnType<typeof getThemeClasses>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(() => {
    const prefs = db.getSharedPreferences();
    return !!prefs.dark_mode;
  });

  useEffect(() => {
    const prefs = db.getSharedPreferences();
    if (prefs.dark_mode !== undefined && prefs.dark_mode !== isDarkMode) {
      setIsDarkModeState(!!prefs.dark_mode);
    }
  }, []);

  const setDarkMode = (enabled: boolean) => {
    setIsDarkModeState(enabled);
    db.saveSharedPreferences({ dark_mode: enabled });
  };

  const toggleDarkMode = () => {
    setDarkMode(!isDarkMode);
  };

  const theme = getThemeClasses(isDarkMode);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
