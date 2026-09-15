import { describe, it, expect, beforeEach } from 'vitest';
import installmentsRoutes from './index.js';
import { buildApp, TEST_USER_ID, OTHER_USER_ID } from '../../test/helpers.js';
import { installmentPlan, creditCard, category, installment, invoice } from '../../db/schema/index.js';

const CARD_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaabbbb';
const PLAN_ID = 'cccccccc-1111-4111-8111-ccccccccdddd';
const CAT_ID = 'eeeeeeee-1111-4111-8111-eeeeeeeeffff';

describe('installments routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(installmentsRoutes, '/api/v1/installments');
    app = harness.app;
    db = harness.db;
  });

  function seedPlan(userId = TEST_USER_ID) {
    db.seed(creditCard, [{
      id: CARD_ID, userId, name: 'Visa', institution: 'Nubank', brand: 'VISA', last4: '1234',
      limitCents: 100000, availableLimitCents: 50000, closingDay: 5, dueDay: 10, status: 'ACTIVE',
      createdAt: new Date(), updatedAt: new Date(),
    }]);
    db.seed(category, [{ id: CAT_ID, userId, name: 'Compras', isDefault: false, createdAt: new Date(), updatedAt: new Date() }]);
    db.seed(installmentPlan, [{
      id: PLAN_ID, userId, cardId: CARD_ID, description: 'Notebook', totalAmountCents: 300000,
      installmentsCount: 10, installmentValueCents: 30000, startDate: new Date(), firstInvoiceDate: new Date(), categoryId: CAT_ID,
      createdAt: new Date(), updatedAt: new Date(),
    }]);
    db.seed(installment, [{
      id: 'bbbbbbbb-1111-4111-8111-bbbbbbbbcccc', planId: PLAN_ID, number: 1, amountCents: 30000,
      dueDate: new Date(), status: 'PENDING', createdAt: new Date(), updatedAt: new Date(),
    }]);
    db.seed(invoice, [{
      id: 'dddddddd-1111-4111-8111-ddddddddeeee', cardId: CARD_ID, periodStart: new Date(), periodEnd: new Date(),
      closingDate: new Date(), dueDate: new Date(), totalCents: 30000, paidCents: 0, remainingCents: 30000,
      status: 'OPEN', createdAt: new Date(), updatedAt: new Date(),
    }]);
  }

  it('gets an installment plan with installments', async () => {
    seedPlan();
    const res = await app.inject({ method: 'GET', url: `/api/v1/installments/${PLAN_ID}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.description).toBe('Notebook');
    expect(body.totalAmount).toEqual({ cents: 300000, currency: 'BRL' });
    expect(body.installments).toHaveLength(1);
  });

  it('returns 404 when getting a plan owned by another user', async () => {
    seedPlan(OTHER_USER_ID);
    const res = await app.inject({ method: 'GET', url: `/api/v1/installments/${PLAN_ID}` });
    expect(res.statusCode).toBe(404);
  });

  it('lists installments with count metadata', async () => {
    seedPlan();
    const res = await app.inject({ method: 'GET', url: '/api/v1/installments' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].plan.description).toBe('Notebook');
    expect(body.meta.total).toBe(1);
  });

  it('updates an installment plan', async () => {
    seedPlan();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/installments/${PLAN_ID}`,
      payload: { description: 'Notebook Gamer' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().description).toBe('Notebook Gamer');
  });

  it('returns 404 when updating a non-existent plan', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/installments/00000000-0000-4000-8000-000000000000',
      payload: { description: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });
});