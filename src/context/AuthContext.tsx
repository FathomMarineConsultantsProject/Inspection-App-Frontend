import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import API, { setAuthToken } from "../services/api";
import { loginService, registerService } from "../services/auth.service";

const USE_MOCK_AUTH = false;
const TOKEN_KEY = "access_token";
const USER_NAME_KEY = "user_name";
const USER_EMAIL_KEY = "email";
const ASYNC_USER_KEY = "user";
const ASYNC_TOKEN_KEY = "token";
const ASYNC_TOKEN_EXPIRY_KEY = "tokenExpiry";
const TOKEN_VALID_MS = 72 * 60 * 60 * 1000;

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

  function isNetworkError(error: any): boolean {
    return !error?.response;
  }

  async function saveUserSnapshot(params: { name?: string; email?: string }) {
    const { name, email } = params;
    if (name) {
      await SecureStore.setItemAsync(USER_NAME_KEY, name);
    }
    if (email) {
      await SecureStore.setItemAsync(USER_EMAIL_KEY, email);
    }
  }

  async function persistSessionToAsyncStorage(
    accessToken: string,
    user: { full_name?: string; name?: string; email?: string }
  ) {
    const expiry = Date.now() + TOKEN_VALID_MS;
    await AsyncStorage.multiSet([
      [ASYNC_TOKEN_KEY, accessToken],
      [ASYNC_TOKEN_EXPIRY_KEY, String(expiry)],
      [
        ASYNC_USER_KEY,
        JSON.stringify({
          full_name: user.full_name || user.name || "",
          email: user.email || "",
        }),
      ],
    ]);
  }

  async function clearAsyncAuthStorage() {
    await AsyncStorage.multiRemove([ASYNC_TOKEN_KEY, ASYNC_TOKEN_EXPIRY_KEY, ASYNC_USER_KEY]);
  }

  async function login(email: string, password: string) {
    setIsLoading(true);
    try {
      if (USE_MOCK_AUTH) {
        // ✅ accept ANY credentials
        await new Promise((res) => setTimeout(res, 300));
        const mockToken = "mock-token-123";
        await SecureStore.setItemAsync(TOKEN_KEY, mockToken);
        setToken(mockToken);
        setAuthToken(mockToken);
        await saveUserSnapshot({ email });
        await persistSessionToAsyncStorage(mockToken, { email });
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
      await saveUserSnapshot({
        name: res.user?.full_name || res.user?.name,
        email: res.user?.email || email,
      });
      await persistSessionToAsyncStorage(accessToken, {
        full_name: res.user?.full_name || res.user?.name,
        email: res.user?.email || email,
      });
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
        setAuthToken(mockToken);
        await saveUserSnapshot({ name, email });
        await persistSessionToAsyncStorage(mockToken, { full_name: name, email });
        return;
      }

      await registerService(name, email, password);
      await saveUserSnapshot({ name, email });
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
    await clearAsyncAuthStorage();
    setToken(null);
    setAuthToken(null);
  }

  useEffect(() => {
    (async () => {
      try {
        const expiryStr = await AsyncStorage.getItem(ASYNC_TOKEN_EXPIRY_KEY);
        if (expiryStr && Date.now() > Number(expiryStr)) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await clearAsyncAuthStorage();
          setToken(null);
          setAuthToken(null);
          return;
        }

        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          setToken(saved);
          setAuthToken(saved);
          try {
            await API.get("/profile");
          } catch (error: any) {
            if (!isNetworkError(error)) {
              await SecureStore.deleteItemAsync(TOKEN_KEY);
              await clearAsyncAuthStorage();
              setToken(null);
              setAuthToken(null);
            }
          }
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
