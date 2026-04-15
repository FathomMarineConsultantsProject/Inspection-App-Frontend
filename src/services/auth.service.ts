import API from './api';

export type LoginResponse = {
  access_token: string;
  token_type?: string;
  session?: {
    access_token: string;
  };
};

export type RegisterResponse = {
  access_token: string;
  token_type?: string;
  session?: {
    access_token: string;
  };
};

/**
 * Login user with email and password
 */
export async function loginService(
  email: string,
  password: string
): Promise<LoginResponse> {
  try {
    const res = await API.post('/login', { email, password });
    return res.data;
  } catch (error: any) {
    const message = error.response?.data?.message || error.message || 'Login failed';
    throw new Error(message);
  }
}

/**
 * Register user with name, email, and password
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
  try {
    const hasThreeArgs = typeof arg3 === 'string';
    const full_name = hasThreeArgs ? arg1 : '';
    const email = hasThreeArgs ? arg2 : arg1;
    const password = hasThreeArgs ? (arg3 as string) : arg2;
    const res = await API.post('/register', { email, password, full_name });
    return res.data;
  } catch (error: any) {
    const message = error.response?.data?.message || error.message || 'Registration failed';
    throw new Error(message);
  }
}

export async function registerUser(email: string, password: string, full_name: string) {
  const res = await API.post('/register', {
    email,
    password,
    full_name,
  });
  return res.data;
}