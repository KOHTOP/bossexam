import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Sparkles, Coffee, Ghost } from 'lucide-react';

type Theme = 'light' | 'dark';

interface ThemeIcon {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  themeIcons: ThemeIcon[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const themeIcons: ThemeIcon[] = [
  { id: 'light', icon: <Sun size={20} />, label: 'Светлая' },
  { id: 'dark', icon: <Moon size={20} />, label: 'Темная' },
  { id: 'system', icon: <Monitor size={20} />, label: 'Системная' },
  { id: 'sparkle', icon: <Sparkles size={20} />, label: 'Магическая' },
  { id: 'coffee', icon: <Coffee size={20} />, label: 'Кофейная' },
  { id: 'ghost', icon: <Ghost size={20} />, label: 'Призрачная' },
];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeIcons }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
