import * as SecureStore from "expo-secure-store";
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { setAuthToken } from "../services/api";
import { loginService, registerService } from "../services/auth.service";

const USE_MOCK_AUTH = false;
const TOKEN_KEY = "access_token";

type AuthContextType = {
  token: string | null;
  isLoading: boolean;
  bootstrapping:boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  async function login(email: string, password: string) {
    setIsLoading(true);
    try {
      if (USE_MOCK_AUTH) {
        // ✅ accept ANY credentials
        await new Promise((res) => setTimeout(res, 300));
        const mockToken = "mock-token-123";
        await SecureStore.setItemAsync(TOKEN_KEY, mockToken);
        setToken(mockToken);
        return;
      }

      const res = await loginService(email, password);
      // Extract token from either res.session?.access_token or res.access_token
      const accessToken = res.session?.access_token || res.access_token;
      
      if (!accessToken) {
        throw new Error("No access token in response");
      }

      await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
      setToken(accessToken);
      setAuthToken(accessToken);
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
        // ✅ accept ANY credentials
        await new Promise((res) => setTimeout(res, 300));
        const mockToken = "mock-token-123";
        await SecureStore.setItemAsync(TOKEN_KEY, mockToken);
        setToken(mockToken);
        return;
      }

      await registerService(name, email, password);
      // After registration, login automatically
      await login(email, password);
    } catch (error: any) {
      console.error("Register error:", error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setAuthToken(null);
  }

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          setToken(saved);
          setAuthToken(saved);
        }
      } catch (error) {
        console.error("Error restoring token:", error);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  return (
    <AuthContext.Provider value={{ token, isLoading, bootstrapping,login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
