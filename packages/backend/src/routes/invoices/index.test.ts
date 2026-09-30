import { describe, it, expect, beforeEach } from 'vitest';
import invoicesRoutes from './index.js';
import { buildApp } from '../../test/helpers.js';

describe('invoices routes', () => {
  let app: any;

  beforeEach(async () => {
    const harness = await buildApp(invoicesRoutes, '/api/v1/invoices');
    app = harness.app;
  });

  it('returns empty array when user has no cards without crashing on inArray', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/invoices' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
    expect(res.json().meta.total).toBe(0);
  });

  it('returns empty array on upcoming invoices when user has no cards', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/invoices/upcoming' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
