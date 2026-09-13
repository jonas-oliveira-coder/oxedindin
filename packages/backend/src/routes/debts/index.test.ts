import { describe, it, expect, beforeEach } from 'vitest';
import debtsRoutes from './index.js';
import { buildApp, TEST_USER_ID, OTHER_USER_ID } from '../../test/helpers.js';
import { debt, person, debtSplit } from '../../db/schema/index.js';

describe('debts routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(debtsRoutes, '/api/v1/debts');
    app = harness.app;
    db = harness.db;
  });

  it('creates a debt mapping totalAmount to cents columns', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/debts',
      payload: {
        description: 'Empréstimo',
        totalAmount: 100000,
        dueDate: new Date().toISOString(),
        type: 'PERSONAL_LOAN',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().totalAmount).toEqual({ cents: 100000, currency: 'BRL' });
    expect(res.json().paidAmount).toEqual({ cents: 0, currency: 'BRL' });
    expect(res.json().remainingAmount).toEqual({ cents: 100000, currency: 'BRL' });

    const rows = db.all(debt);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalAmountCents).toBe(100000);
    expect(rows[0].remainingAmountCents).toBe(100000);
    expect(rows[0].userId).toBe(TEST_USER_ID);
    expect(rows[0]).not.toHaveProperty('totalAmount');
  });

  it('updates a debt mapping totalAmount to cents columns', async () => {
    db.seed(debt, [{
      id: '12345678-1234-4234-8234-123456789012',
      userId: TEST_USER_ID,
      description: 'Dívida',
      totalAmountCents: 50000,
      paidAmountCents: 0,
      remainingAmountCents: 50000,
      dueDate: new Date(),
      type: 'PURCHASE',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/debts/12345678-1234-4234-8234-123456789012',
      payload: { totalAmount: 60000 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().totalAmount).toEqual({ cents: 60000, currency: 'BRL' });
    expect(res.json().remainingAmount).toEqual({ cents: 60000, currency: 'BRL' });

    const rows = db.all(debt);
    expect(Number(rows[0].totalAmountCents)).toBe(60000);
    expect(Number(rows[0].remainingAmountCents)).toBe(60000);
  });

  it('registers a payment on a debt', async () => {
    db.seed(debt, [{
      id: '23456789-2345-4234-8234-234567890123',
      userId: TEST_USER_ID,
      description: 'Cartão',
      totalAmountCents: 10000,
      paidAmountCents: 0,
      remainingAmountCents: 10000,
      dueDate: new Date(),
      type: 'CREDIT_CARD',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/debts/23456789-2345-4234-8234-234567890123/pay',
      payload: { amount: 4000 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().paidAmount).toEqual({ cents: 4000, currency: 'BRL' });
    expect(res.json().remainingAmount).toEqual({ cents: 6000, currency: 'BRL' });
  });

  it('returns 404 when getting a debt owned by another user', async () => {
    db.seed(debt, [{
      id: '34567890-3456-4234-8234-345678901234',
      userId: OTHER_USER_ID,
      description: 'Outra',
      totalAmountCents: 1000,
      paidAmountCents: 0,
      remainingAmountCents: 1000,
      dueDate: new Date(),
      type: 'OTHER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/debts/34567890-3456-4234-8234-345678901234' });
    expect(res.statusCode).toBe(404);
  });

  it('cancels a debt on delete', async () => {
    db.seed(debt, [{
      id: '45678901-4567-4234-8234-456789012345',
      userId: TEST_USER_ID,
      description: 'Cancelar',
      totalAmountCents: 1000,
      paidAmountCents: 0,
      remainingAmountCents: 1000,
      dueDate: new Date(),
      type: 'OTHER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'DELETE', url: '/api/v1/debts/45678901-4567-4234-8234-456789012345' });
    expect(res.statusCode).toBe(200);
    expect(db.all(debt)).toHaveLength(0);
  });

  it('creates a debt split for a person', async () => {
    db.seed(debt, [{
      id: '56789012-5678-4234-8234-567890123456',
      userId: TEST_USER_ID,
      description: 'Dividir',
      totalAmountCents: 100000,
      paidAmountCents: 0,
      remainingAmountCents: 100000,
      dueDate: new Date(),
      type: 'PURCHASE',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    db.seed(person, [{
      id: '11111111-1111-4111-8111-111111111111',
      userId: TEST_USER_ID,
      name: 'Maria',
      type: 'INDIVIDUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/debts/56789012-5678-4234-8234-567890123456/splits',
      payload: { personId: '11111111-1111-4111-8111-111111111111', amountCents: 40000 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().amount).toEqual({ cents: 40000, currency: 'BRL' });
    expect(db.all(debtSplit)).toHaveLength(1);
    expect(db.all(debtSplit)[0].debtId).toBe('56789012-5678-4234-8234-567890123456');
  });

  it('rejects a split exceeding the remaining debt value', async () => {
    db.seed(debt, [{
      id: '67890123-6789-4234-8234-678901234567',
      userId: TEST_USER_ID,
      description: 'Limite',
      totalAmountCents: 10000,
      paidAmountCents: 0,
      remainingAmountCents: 10000,
      dueDate: new Date(),
      type: 'OTHER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    db.seed(person, [{
      id: '22222222-2222-4222-8222-222222222222',
      userId: TEST_USER_ID,
      name: 'João',
      type: 'INDIVIDUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/debts/67890123-6789-4234-8234-678901234567/splits',
      payload: { personId: '22222222-2222-4222-8222-222222222222', amountCents: 20000 },
    });

    expect(res.statusCode).toBe(400);
  });
});