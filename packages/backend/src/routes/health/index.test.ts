import { describe, it, expect, beforeEach } from 'vitest';
import healthRoutes from './index.js';
import { buildApp } from '../../test/helpers.js';

describe('health route', () => {
  let app: any;

  beforeEach(async () => {
    const harness = await buildApp(healthRoutes, '/api/v1/health');
    app = harness.app;
  });

  it('returns ok status and only database service without redis', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.services).toEqual({ database: 'ok' });
    expect(body.services).not.toHaveProperty('redis');
  });
});
