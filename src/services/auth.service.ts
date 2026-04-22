import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

export type LoginResponse = {
  access_token: string;
  token_type?: string;
  user?: {
    id?: string;
    name?: string;
    full_name?: string;
    email?: string;
  };
  session?: {
    access_token: string;
  };
};

export type RegisterResponse = {
  access_token: string;
  token_type?: string;
  user?: {
    id?: string;
    name?: string;
    full_name?: string;
    email?: string;
  };
  session?: {
    access_token: string;
  };
};

function mapAuthResponse(user: User | null, session: Session | null): LoginResponse {
  return {
    access_token: session?.access_token || "",
    token_type: session?.token_type || "bearer",
    user: user
      ? {
          id: user.id,
          full_name:
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined),
          name: user.user_metadata?.name as string | undefined,
          email: user.email,
        }
      : undefined,
    session: session ? { access_token: session.access_token } : undefined,
  };
}

/**
 * Login user with email and password using Supabase Auth.
 */
export async function loginService(
  email: string,
  password: string
): Promise<LoginResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message || "Login failed");
  }

  return mapAuthResponse(data.user, data.session);
}

export const register = async (
  email: string,
  password: string,
  full_name: string
): Promise<RegisterResponse> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
      },
    },
  });

  if (error) {
    throw new Error(error.message || "Registration failed");
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      full_name,
      email,
    });

    if (profileError) {
      throw new Error(profileError.message || "Failed to create profile");
    }
  }

  return mapAuthResponse(data.user, data.session);
};

/**
 * Register user with name, email, and password using Supabase Auth.
 */
export async function registerService(
  email: string,
  password: string,
  full_name: string
): Promise<RegisterResponse>;
export async function registerService(
  name: string,
  email: string,
  password: string
): Promise<RegisterResponse>;
export async function registerService(
  arg1: string,
  arg2: string,
  arg3?: string
): Promise<RegisterResponse> {
  const hasThreeArgs = typeof arg3 === "string";
  const full_name = hasThreeArgs ? arg1 : "";
  const email = hasThreeArgs ? arg2 : arg1;
  const password = hasThreeArgs ? (arg3 as string) : arg2;
  return register(email, password, full_name);
}

export async function registerUser(email: string, password: string, full_name: string) {
  return registerService(full_name, email, password);
}
