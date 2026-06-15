'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // starts true while we rehydrate

  // Rehydrate from localStorage on first mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('migga_token');
      const storedUser = localStorage.getItem('migga_user');
      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser) as AuthUser);
      }
    } catch {
      // Malformed JSON — clear it
      localStorage.removeItem('migga_token');
      localStorage.removeItem('migga_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // TransformInterceptor wraps every response as { success, data, timestamp }
    // so the actual payload is at response.data.data
    const response = await api.post<{
      success: boolean;
      data: { accessToken: string; user: AuthUser };
      timestamp: string;
    }>('/auth/login', { email, password });

    const { accessToken: token, user: userData } = response.data.data;

    if (!token || !userData) {
      throw new Error('Invalid response from server');
    }

    // Persist
    localStorage.setItem('migga_token', token);
    localStorage.setItem('migga_user', JSON.stringify(userData));

    setAccessToken(token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('migga_token');
    localStorage.removeItem('migga_user');
    setAccessToken(null);
    setUser(null);
    window.location.href = '/signin';
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    isAuthenticated: !!accessToken && !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
