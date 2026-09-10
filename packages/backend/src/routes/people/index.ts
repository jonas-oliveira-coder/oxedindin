import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, asc, count, getTableColumns } from 'drizzle-orm';
import { createPersonSchema, paginationSchema } from '../../types/schemas.js';
import { person, debt, sharedDebt, user } from '../../db/schema/index.js';

const peopleRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: { querystring: paginationSchema },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit } = request.query;
    const userId = request.authUser!.id;

    const [peopleData, totalResult] = await Promise.all([
      app.db.select().from(person)
        .where(eq(person.userId, userId))
        .orderBy(asc(person.name))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(person).where(eq(person.userId, userId)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: peopleData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createPersonSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    if (request.body.email) {
      const [existing] = await app.db.select()
        .from(person)
        .where(and(eq(person.userId, request.authUser!.id), eq(person.email, request.body.email)))
        .limit(1);
      if (existing) throw app.httpErrors.conflict('Person with this email already exists');
    }

    const [newPerson] = await app.db.insert(person).values({
      ...request.body,
      userId: request.authUser!.id,
    }).returning();

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'PERSON_CREATED',
      entityType: 'Person',
      entityId: newPerson.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send(newPerson);
  });

  app.get('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [personRecord] = await app.db.select()
      .from(person)
      .where(and(eq(person.id, request.params.id), eq(person.userId, request.authUser!.id)))
      .limit(1);

    if (!personRecord) throw app.httpErrors.notFound('Person not found');

    const debtsData = await app.db.select({
      ...getTableColumns(debt),
      sharedDebts: sharedDebt,
    })
      .from(debt)
      .leftJoin(sharedDebt, eq(debt.id, sharedDebt.debtId))
      .where(eq(debt.relatedPersonId, personRecord.id));

    const sharedDebtsData = await app.db.select({
      ...getTableColumns(sharedDebt),
      debt: debt,
      creditor: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled, settings: user.settings, createdAt: user.createdAt, updatedAt: user.updatedAt },
    })
      .from(sharedDebt)
      .leftJoin(debt, eq(sharedDebt.debtId, debt.id))
      .leftJoin(user, eq(sharedDebt.creditorUserId, user.id))
      .where(eq(sharedDebt.personId, personRecord.id));

    return {
      ...personRecord,
      debts: debtsData,
      sharedDebts: sharedDebtsData,
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        name: z.string().min(1).max(100).optional(),
        email: z.string().email().nullable().optional(),
        type: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
        phone: z.string().max(20).nullable().optional(),
        document: z.string().max(20).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(person)
      .where(and(eq(person.id, request.params.id), eq(person.userId, request.authUser!.id)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Person not found');

    if (request.body.email && request.body.email !== existing.email) {
      const [duplicate] = await app.db.select()
        .from(person)
        .where(and(eq(person.userId, request.authUser!.id), eq(person.email, request.body.email)))
        .limit(1);
      if (duplicate) throw app.httpErrors.conflict('Person with this email already exists');
    }

    const [updatedPerson] = await app.db.update(person)
      .set(request.body)
      .where(eq(person.id, request.params.id))
      .returning();

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'PERSON_UPDATED',
      entityType: 'Person',
      entityId: updatedPerson.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return updatedPerson;
  });

  app.delete('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    await app.db.delete(person).where(eq(person.id, request.params.id));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'PERSON_DELETED',
      entityType: 'Person',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default peopleRoutes;