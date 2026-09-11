import { describe, it, expect, beforeEach } from 'vitest';
import categoriesRoutes from './index.js';
import { buildApp, TEST_USER_ID, OTHER_USER_ID } from '../../test/helpers.js';
import { category } from '../../db/schema/index.js';

describe('categories routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(categoriesRoutes, '/api/v1/categories');
    app = harness.app;
    db = harness.db;
  });

  it('creates a category', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      payload: { name: 'Lazer', icon: '🎮', color: '#F59E0B' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Lazer');
    expect(res.json().isDefault).toBe(false);

    const rows = db.all(category);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(TEST_USER_ID);
  });

  it('lists categories', async () => {
    db.seed(category, [{
      id: '11111111-aaaa-4aaa-8aaa-111111111111',
      userId: TEST_USER_ID,
      name: 'Alimentação',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/categories' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it('updates a category', async () => {
    db.seed(category, [{
      id: '22222222-bbbb-4bbb-8bbb-222222222222',
      userId: TEST_USER_ID,
      name: 'Compras',
      icon: '🛍️',
      color: '#F97316',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/categories/22222222-bbbb-4bbb-8bbb-222222222222',
      payload: { name: 'Compras Online' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Compras Online');
  });

  it('returns 403 when modifying a default category', async () => {
    db.seed(category, [{
      id: '33333333-cccc-4ccc-8ccc-333333333333',
      userId: TEST_USER_ID,
      name: 'Alimentação',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/categories/33333333-cccc-4ccc-8ccc-333333333333',
      payload: { name: 'Tentativa' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('deletes a category', async () => {
    db.seed(category, [{
      id: '44444444-dddd-4ddd-8ddd-444444444444',
      userId: TEST_USER_ID,
      name: 'Remover',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'DELETE', url: '/api/v1/categories/44444444-dddd-4ddd-8ddd-444444444444' });
    expect(res.statusCode).toBe(200);
    expect(db.all(category)).toHaveLength(0);
  });

  it('initializes default categories', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/categories/initialize-defaults' });
    expect(res.statusCode).toBe(200);
    expect(db.all(category)).toHaveLength(12);
  });
});