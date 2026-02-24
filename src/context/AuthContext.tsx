import React, { createContext, useContext, useEffect, useState } from 'react';

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

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const res = await fetch('/api/me');
    const data = res.ok ? await res.json() : null;
    if (data?.user) setUser(data.user);
  };

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    } else {
      const data = await res.json();
      throw new Error(data.error || 'Ошибка входа');
    }
  };

  const register = async (username: string, password: string) => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    } else {
      const data = await res.json();
      throw new Error(data.error || 'Ошибка регистрации');
    }
  };

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, loading }}>
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
