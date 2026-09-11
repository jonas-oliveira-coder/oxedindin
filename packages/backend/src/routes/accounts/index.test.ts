import { describe, it, expect, beforeEach } from 'vitest';
import accountsRoutes from './index.js';
import { buildApp, TEST_USER_ID, OTHER_USER_ID } from '../../test/helpers.js';
import { bankAccount } from '../../db/schema/index.js';

describe('accounts routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(accountsRoutes, '/api/v1/accounts');
    app = harness.app;
    db = harness.db;
  });

  it('creates an account mapping initialBalance to balance cents columns', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Nubank', institution: 'Nubank', type: 'DIGITAL', initialBalance: 10000 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Nubank');
    expect(body.initialBalance).toEqual({ cents: 10000, currency: 'BRL' });
    expect(body.balance).toEqual({ cents: 10000, currency: 'BRL' });
    expect(body.id).toBeTruthy();

    const rows = db.all(bankAccount);
    expect(rows).toHaveLength(1);
    expect(rows[0].initialBalanceCents).toBe(10000);
    expect(rows[0].balanceCents).toBe(10000);
    expect(rows[0].userId).toBe(TEST_USER_ID);
    expect(rows[0]).not.toHaveProperty('initialBalance');
  });

  it('lists accounts', async () => {
    db.seed(bankAccount, [{
      id: '11111111-1111-4111-8111-111111111111',
      userId: TEST_USER_ID,
      name: 'Itaú',
      institution: 'Itaú',
      type: 'CHECKING',
      balanceCents: 5000,
      initialBalanceCents: 0,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/accounts' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Itaú');
    expect(body.meta.total).toBe(1);
  });

  it('returns 404 when getting an account owned by another user', async () => {
    db.seed(bankAccount, [{
      id: '22222222-2222-4222-8222-222222222222',
      userId: OTHER_USER_ID,
      name: 'Outra',
      institution: 'Banco',
      type: 'CHECKING',
      balanceCents: 0,
      initialBalanceCents: 0,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/accounts/22222222-2222-4222-8222-222222222222' });
    expect(res.statusCode).toBe(404);
  });

  it('updates an account', async () => {
    db.seed(bankAccount, [{
      id: '33333333-3333-4333-8333-333333333333',
      userId: TEST_USER_ID,
      name: 'Bradesco',
      institution: 'Bradesco',
      type: 'CHECKING',
      balanceCents: 0,
      initialBalanceCents: 0,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/accounts/33333333-3333-4333-8333-333333333333',
      payload: { name: 'Bradesco Plus' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Bradesco Plus');
  });

  it('returns 404 when updating a non-existent account', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/accounts/44444444-4444-4444-8444-444444444444',
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('deactivates an account on delete', async () => {
    db.seed(bankAccount, [{
      id: '55555555-5555-4555-8555-555555555555',
      userId: TEST_USER_ID,
      name: 'Santander',
      institution: 'Santander',
      type: 'CHECKING',
      balanceCents: 0,
      initialBalanceCents: 0,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'DELETE', url: '/api/v1/accounts/55555555-5555-4555-8555-555555555555' });
    expect(res.statusCode).toBe(200);
    expect(db.all(bankAccount)[0].status).toBe('INACTIVE');
  });
});