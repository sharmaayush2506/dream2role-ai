import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, token, type Me } from "./api.ts";

interface AuthState {
  user: Me | null;
  loading: boolean;
  setUser: (u: Me) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!token.get());

  useEffect(() => {
    if (!token.get()) return;
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) token.set(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    token.set(res.token);
    setUser(res.user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.signup(name, email, password);
    token.set(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    token.set(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, setUser, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
