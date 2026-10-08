import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getCsrfToken, setCsrfToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
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
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers?.delete) {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      } else if (config.headers) {
        delete (config.headers as Record<string, unknown>)['Content-Type'];
        delete (config.headers as Record<string, unknown>)['content-type'];
      }
    }
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
    const originalRequest = error?.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest) return Promise.reject(error);

    const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest) {
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
  if (isApiError(error) || (typeof error === 'object' && error !== null && 'isAxiosError' in error)) {
    const data: any = (error as any).response?.data;
    if (data) {
      if (typeof data === 'string' && data.trim()) {
        return data;
      }
      // 1. Specific field validation errors
      const fields = data.error?.fields || data.fields;
      if (fields && typeof fields === 'object') {
        const values = Object.values(fields).filter(Boolean);
        if (values.length > 0) return values.join(' ');
      }
      // 2. Nested error object with message
      if (data.error && typeof data.error === 'object' && typeof data.error.message === 'string' && data.error.message.trim()) {
        return data.error.message;
      }
      // 3. Fastify direct message string (e.g. app.httpErrors.conflict("..."))
      if (typeof data.message === 'string' && data.message.trim()) {
        return data.message;
      }
      // 4. Direct error string
      if (typeof data.error === 'string' && data.error.trim()) {
        return data.error;
      }
      // 5. Details string
      if (typeof data.details === 'string' && data.details.trim()) {
        return data.details;
      }
    }
    if ((error as any).response?.statusText) {
      return (error as any).response.statusText;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (isApiError(error) || (typeof error === 'object' && error !== null && 'isAxiosError' in error)) {
    const data: any = (error as any).response?.data;
    return data?.error?.fields || data?.fields || {};
  }
  return {};
}