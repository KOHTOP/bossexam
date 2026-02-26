import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, setToken, removeToken, authFetch } from '../lib/auth';

interface User {
  id: number;
  username: string;
  role: 'superadmin' | 'admin' | 'user';
  display_name?: string;
  avatar?: string;
  telegram?: string;
  is_verified?: boolean;
  is_blocked?: boolean;
  block_reason?: string;
  balance?: number;
  created_at?: string | null;
}

export interface TelegramAuthUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginWithTelegram: (telegramUser: TelegramAuthUser) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const res = await authFetch('/api/me');
    const data = res.ok ? await res.json() : { user: null };
    setUser(data?.user ?? null);
  };

  useEffect(() => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    authFetch('/api/me')
      .then(res => res.ok ? res.json() : { user: null })
      .then(data => {
        setUser(data?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Ошибка входа');
    }
    const data = await res.json();
    if (data.token) setToken(data.token);
    setUser(data.user);
  };

  const register = async (username: string, password: string) => {
    const res = await authFetch('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Ошибка регистрации');
    }
    const data = await res.json();
    if (data.token) setToken(data.token);
    setUser(data.user);
  };

  const loginWithTelegram = async (telegramUser: TelegramAuthUser) => {
    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramUser),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Ошибка входа через Telegram');
    }
    const data = await res.json();
    if (data.token) setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await authFetch('/api/logout', { method: 'POST' });
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithTelegram, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
