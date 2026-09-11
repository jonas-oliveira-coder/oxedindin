import { describe, it, expect, beforeEach } from 'vitest';
import billsRoutes from './index.js';
import { buildApp, TEST_USER_ID, OTHER_USER_ID } from '../../test/helpers.js';
import { bill, recurringBill } from '../../db/schema/index.js';

describe('bills routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(billsRoutes, '/api/v1/bills');
    app = harness.app;
    db = harness.db;
  });

  it('creates a bill mapping amount to amountCents', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bills',
      payload: {
        description: 'Energia',
        amount: 15000,
        dueDate: new Date().toISOString(),
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().description).toBe('Energia');
    expect(res.json().amount).toEqual({ cents: 15000, currency: 'BRL' });

    const rows = db.all(bill);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(15000);
    expect(rows[0].userId).toBe(TEST_USER_ID);
    expect(rows[0]).not.toHaveProperty('amount');
  });

  it('updates a bill mapping amount to amountCents', async () => {
    db.seed(bill, [{
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      userId: TEST_USER_ID,
      description: 'Água',
      amountCents: 8000,
      dueDate: new Date(),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/bills/dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      payload: { amount: 9000 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().amount).toEqual({ cents: 9000, currency: 'BRL' });
    expect(db.all(bill)[0].amountCents).toBe(9000);
    expect(db.all(bill)[0]).not.toHaveProperty('amount');
  });

  it('creates a recurring bill mapping amount to amountCents', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bills/recurring',
      payload: {
        description: 'Netflix',
        amount: 3990,
        frequency: 'MONTHLY',
        dueDay: 10,
        startDate: new Date().toISOString(),
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().description).toBe('Netflix');
    expect(res.json().amount).toEqual({ cents: 3990, currency: 'BRL' });

    const rows = db.all(recurringBill);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(3990);
    expect(rows[0]).not.toHaveProperty('amount');
  });

  it('updates a recurring bill mapping amount to amountCents', async () => {
    db.seed(recurringBill, [{
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      userId: TEST_USER_ID,
      description: 'Spotify',
      amountCents: 1990,
      frequency: 'MONTHLY',
      dueDay: 5,
      startDate: new Date(),
      nextDueDate: new Date(),
      status: 'ACTIVE',
      dateType: 'FIXED',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/bills/recurring/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      payload: { amount: 2490 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().amount).toEqual({ cents: 2490, currency: 'BRL' });
    expect(db.all(recurringBill)[0].amountCents).toBe(2490);
  });

  it('returns 404 when getting a bill owned by another user', async () => {
    db.seed(bill, [{
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      userId: OTHER_USER_ID,
      description: 'Outra',
      amountCents: 100,
      dueDate: new Date(),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/bills/ffffffff-ffff-4fff-8fff-ffffffffffff' });
    expect(res.statusCode).toBe(404);
  });

  it('cancels a bill on delete', async () => {
    db.seed(bill, [{
      id: '11112222-3333-4444-8555-666677778888',
      userId: TEST_USER_ID,
      description: 'Net',
      amountCents: 5000,
      dueDate: new Date(),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'DELETE', url: '/api/v1/bills/11112222-3333-4444-8555-666677778888' });
    expect(res.statusCode).toBe(200);
    expect(db.all(bill)[0].status).toBe('CANCELLED');
  });
});