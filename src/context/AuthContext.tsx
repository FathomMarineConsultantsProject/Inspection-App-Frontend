import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { loginService, registerService } from "../services/auth.service";
import { supabase } from "../supabaseClient";

const USE_MOCK_AUTH = false;

type AuthUser = {
  id?: string;
  full_name?: string;
  name?: string;
  email?: string;
};

type AuthContextType = {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  bootstrapping:boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  async function login(email: string, password: string) {
    setIsLoading(true);
    try {
      if (USE_MOCK_AUTH) {
        await new Promise((res) => setTimeout(res, 300));
        const mockToken = "mock-token-123";
        setToken(mockToken);
        setUser({ email });
        return;
      }

      const res = await loginService(email, password);
      const accessToken = res.session?.access_token || res.access_token;

      if (!accessToken) {
        throw new Error("No access token in response");
      }

      const userFromLogin: AuthUser = {
        id: res.user?.id,
        full_name: res.user?.full_name,
        name: res.user?.name,
        email: res.user?.email || email,
      };
      setToken(accessToken);
      setUser(userFromLogin);
    } catch (error: any) {
      console.error("Login error:", error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function register(name: string, email: string, password: string) {
    setIsLoading(true);
    try {
      if (USE_MOCK_AUTH) {
        await new Promise((res) => setTimeout(res, 300));
        const mockToken = "mock-token-123";
        setToken(mockToken);
        setUser({ full_name: name, email });
        return;
      }

      await registerService(name, email, password);
      await login(email, password);
    } catch (error: any) {
      console.error("Register error:", error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    const init = async () => {
      console.log("INIT AUTH");
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        console.log("SESSION FOUND:", data.session.user.id);
        setUser(data.session.user);
        setToken(data.session.access_token);
      } else {
        console.log("NO SESSION FOUND");
        setUser(null);
        setToken(null);
      }
      setBootstrapping(false);
    };

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("AUTH STATE CHANGE:", _event);
      setUser(session?.user ?? null);
      setToken(session?.access_token ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, bootstrapping,login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
