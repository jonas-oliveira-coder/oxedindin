import { describe, it, expect, beforeEach } from 'vitest';
import peopleRoutes from './index.js';
import { buildApp, TEST_USER_ID } from '../../test/helpers.js';
import { person } from '../../db/schema/index.js';

describe('people routes', () => {
  let app: any;
  let db: any;

  beforeEach(async () => {
    const harness = await buildApp(peopleRoutes, '/api/v1/people');
    app = harness.app;
    db = harness.db;
  });

  it('creates a person', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/people',
      payload: { name: 'João', email: 'joao@example.com', type: 'INDIVIDUAL' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('João');
    expect(res.json().userId).toBe(TEST_USER_ID);

    expect(db.all(person)).toHaveLength(1);
  });

  it('rejects a duplicate email', async () => {
    db.seed(person, [{
      id: '55555555-eeee-4eee-8eee-555555555555',
      userId: TEST_USER_ID,
      name: 'Maria',
      email: 'maria@example.com',
      type: 'INDIVIDUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/people',
      payload: { name: 'Outra Maria', email: 'maria@example.com' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('lists people', async () => {
    db.seed(person, [{
      id: '66666666-ffff-4fff-8fff-666666666666',
      userId: TEST_USER_ID,
      name: 'Ana',
      type: 'INDIVIDUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/people' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it('updates a person', async () => {
    db.seed(person, [{
      id: '77777777-aaaa-4aab-8aac-777777777777',
      userId: TEST_USER_ID,
      name: 'Carlos',
      type: 'INDIVIDUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/people/77777777-aaaa-4aab-8aac-777777777777',
      payload: { name: 'Carlos Silva' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Carlos Silva');
  });

  it('gets a person with no related debts', async () => {
    db.seed(person, [{
      id: '88888888-bbbb-4bbc-8bbc-888888888888',
      userId: TEST_USER_ID,
      name: 'Bia',
      type: 'INDIVIDUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/people/88888888-bbbb-4bbc-8bbc-888888888888' });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Bia');
    expect(res.json().debts).toEqual([]);
  });

  it('deletes a person', async () => {
    db.seed(person, [{
      id: '99999999-cccc-4ccc-8ccc-999999999999',
      userId: TEST_USER_ID,
      name: 'Remover',
      type: 'INDIVIDUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const res = await app.inject({ method: 'DELETE', url: '/api/v1/people/99999999-cccc-4ccc-8ccc-999999999999' });
    expect(res.statusCode).toBe(200);
    expect(db.all(person)).toHaveLength(0);
  });
});