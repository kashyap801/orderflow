import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setAuthToken } from '../api/client';
import type { AuthResult, PublicUser, Role } from '../types';

const TOKEN_KEY = 'orderflow.token';
const USER_KEY = 'orderflow.user';

interface RegisterInput {
  email: string;
  password: string;
  role: Role;
}

interface AuthState {
  user?: PublicUser;
  login(email: string, password: string): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const initialToken = localStorage.getItem(TOKEN_KEY);
if (initialToken !== null) setAuthToken(initialToken);

function savedUser(): PublicUser | undefined {
  const raw = localStorage.getItem(USER_KEY);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as PublicUser;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | undefined>(savedUser);

  const apply = useCallback((result: AuthResult) => {
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setAuthToken(result.accessToken);
    setUser(result.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api<AuthResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      apply(result);
    },
    [apply],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await api<PublicUser>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthToken(undefined);
    setUser(undefined);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ...(user === undefined ? {} : { user }), login, register, logout }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
