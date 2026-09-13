import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getCsrfToken, setCsrfToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

let csrfPromise: Promise<void> | null = null;

async function ensureCsrfToken(): Promise<void> {
  if (getCsrfToken()) return;
  if (!csrfPromise) {
    csrfPromise = (async () => {
      const response = await api.get('/auth/csrf');
      setCsrfToken(response.data.csrfToken);
    })();
  }
  try {
    await csrfPromise;
  } finally {
    csrfPromise = null;
  }
}

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (UNSAFE_METHODS.has((config.method ?? '').toLowerCase())) {
      await ensureCsrfToken();
      const token = getCsrfToken();
      if (token) config.headers['x-csrf-token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve: () => resolve(undefined), reject });
        })
          .then(() => {
            originalRequest._retry = true;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch {
        processQueue(new Error('Sessão expirada'));
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export function isApiError(error: unknown): error is AxiosError<ApiErrorBody> {
  return axios.isAxiosError(error);
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.response?.data?.error?.message || 'Erro desconhecido.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Erro desconhecido.';
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (isApiError(error)) {
    return error.response?.data?.error?.fields || {};
  }
  return {};
}