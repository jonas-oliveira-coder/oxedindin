import { describe, it, expect } from 'vitest';
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { getErrorMessage } from './api';
import { setCsrfToken } from './auth';

describe('getErrorMessage', () => {
  it('extracts specific field validation errors over generic messages', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Existem dados inválidos.',
            fields: {
              'body.amount': 'O valor deve ser maior que zero.',
            },
          },
        },
      },
    };

    const message = getErrorMessage(error);
    expect(message).toBe('O valor deve ser maior que zero.');
  });

  it('extracts direct Fastify message string when error is string (e.g. 409 conflict)', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          statusCode: 409,
          error: 'Conflict',
          message: 'Não é possível excluir este cartão porque existem faturas vinculadas.',
        },
      },
    };

    const message = getErrorMessage(error);
    expect(message).toBe('Não é possível excluir este cartão porque existem faturas vinculadas.');
  });

  it('extracts error string when no message is present', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          error: 'Serviço indisponível temporariamente',
        },
      },
    };

    expect(getErrorMessage(error)).toBe('Serviço indisponível temporariamente');
  });

  it('removes Content-Type header for FormData requests so the browser boundary is preserved', async () => {
    setCsrfToken('mock-csrf-token');
    const { api } = await import('./api');
    class MockFormData {}
    const originalFormData = globalThis.FormData;
    // @ts-expect-error mock FormData
    globalThis.FormData = MockFormData;

    try {
      const config = {
        method: 'post',
        data: new MockFormData(),
        headers: new AxiosHeaders({ 'Content-Type': 'application/json' }),
      } as unknown as InternalAxiosRequestConfig;

      // Call interceptor
      // @ts-expect-error access interceptor handler
      const handler = api.interceptors.request.handlers[0].fulfilled;
      const modifiedConfig = await handler(config);

      expect(modifiedConfig.headers.has('Content-Type')).toBe(false);
    } finally {
      globalThis.FormData = originalFormData;
    }
  });
});
