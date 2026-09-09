import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api as apiClient } from '@/lib/api';
import { getAuthTokens, setAuthTokens, clearAuthTokens, isAuthenticated } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const tokens = getAuthTokens();
      if (!tokens) {
        setUser(null);
        return;
      }

      const response = await apiClient.get('/users/me');
      setUser(response.data);
    } catch {
      setUser(null);
      clearAuthTokens();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: userData } = response.data;
    
    setAuthTokens({ accessToken, refreshToken, expiresIn: 15 * 60 });
    setUser(userData);
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await apiClient.post('/auth/register', { email, password, name });
    const { accessToken, refreshToken, user: userData } = response.data;
    
    setAuthTokens({ accessToken, refreshToken, expiresIn: 15 * 60 });
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearAuthTokens();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}