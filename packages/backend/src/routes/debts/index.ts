import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, gte, lte, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { createDebtSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';
import { debt, person, sharedDebt, user, bankAccount, transaction, notification } from '../../db/schema';

const debtsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, startDate, endDate, status, type } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(debt.userId, userId)];
    if (startDate) conditions.push(gte(debt.dueDate, new Date(startDate)));
    if (endDate) conditions.push(lte(debt.dueDate, new Date(endDate)));
    if (status) conditions.push(eq(debt.status, status));
    if (type) conditions.push(eq(debt.type, type));

    const [debtsData, totalResult] = await Promise.all([
      app.db.select({
        ...debt,
        relatedPerson: person,
        sharedDebts: {
          id: sharedDebt.id,
          debtorUserId: sharedDebt.debtorUserId,
          creditorUserId: sharedDebt.creditorUserId,
          personId: sharedDebt.personId,
          status: sharedDebt.status,
          notifiedAt: sharedDebt.notifiedAt,
          acceptedAt: sharedDebt.acceptedAt,
          createdAt: sharedDebt.createdAt,
          updatedAt: sharedDebt.updatedAt,
          debtor: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled, settings: user.settings, createdAt: user.createdAt, updatedAt: user.updatedAt },
        },
      })
        .from(debt)
        .leftJoin(person, eq(debt.relatedPersonId, person.id))
        .leftJoin(sharedDebt, eq(debt.id, sharedDebt.debtId))
        .leftJoin(user, eq(sharedDebt.debtorUserId, user.id))
        .where(and(...conditions))
        .orderBy(asc(debt.dueDate))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(debt).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    // Group shared debts by debt
    const debtMap = new Map<string, any>();
    for (const d of debtsData) {
      if (!debtMap.has(d.debt.id)) {
        debtMap.set(d.debt.id, {
          ...d.debt,
          relatedPerson: d.relatedPerson,
          sharedDebts: [],
        });
      }
      if (d.sharedDebts.id) {
        debtMap.get(d.debt.id).sharedDebts.push({
          ...d.sharedDebts,
          debtor: d.sharedDebts.debtor,
        });
      }
    }

    return {
      data: Array.from(debtMap.values()).map((d) => ({
        ...d,
        totalAmount: { cents: Number(d.totalAmountCents), currency: 'BRL' as const },
        paidAmount: { cents: Number(d.paidAmountCents), currency: 'BRL' as const },
        remainingAmount: { cents: Number(d.remainingAmountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createDebtSchema,
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { description, totalAmount, dueDate, type, relatedPersonId, notes } = request.body;
    const userId = request.authUser!.id;

    if (relatedPersonId) {
      const [personRecord] = await app.db.select()
        .from(person)
        .where(and(eq(person.id, relatedPersonId), eq(person.userId, userId)))
        .limit(1);
      if (!personRecord) throw app.httpErrors.badRequest('Person not found');
    }

    const [newDebt] = await app.db.insert(debt).values({
      userId,
      description,
      totalAmountCents: totalAmount,
      paidAmountCents: 0,
      remainingAmountCents: totalAmount,
      dueDate: new Date(dueDate),
      type,
      relatedPersonId,
      notes,
      status: 'ACTIVE',
    }).returning();

    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(eq(debt.id, newDebt.id))
      .limit(1);

    await app.auditLog({
      userId,
      action: 'DEBT_CREATED',
      entityType: 'Debt',
      entityId: newDebt.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...debtWithPerson!.debt,
      relatedPerson: debtWithPerson!.relatedPerson,
      totalAmount: { cents: Number(debtWithPerson!.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson!.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson!.debt.remainingAmountCents), currency: 'BRL' as const },
    });
  });

  app.get('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(debt.userId, request.authUser!.id)))
      .limit(1);

    if (!debtWithPerson) throw app.httpErrors.notFound('Debt not found');

    const sharedDebtsData = await app.db.select({
      ...sharedDebt,
      debtor: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled, settings: user.settings, createdAt: user.createdAt, updatedAt: user.updatedAt },
    })
      .from(sharedDebt)
      .leftJoin(user, eq(sharedDebt.debtorUserId, user.id))
      .where(eq(sharedDebt.debtId, debtWithPerson.debt.id));

    return {
      ...debtWithPerson.debt,
      relatedPerson: debtWithPerson.relatedPerson,
      sharedDebts: sharedDebtsData,
      totalAmount: { cents: Number(debtWithPerson.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson.debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        totalAmount: z.number().int().positive().optional(),
        dueDate: z.string().datetime().optional(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']).optional(),
        relatedPersonId: z.string().cuid().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const [existing] = await app.db.select()
      .from(debt)
      .where(and(eq(debt.id, request.params.id), eq(debt.userId, request.authUser!.id)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Debt not found');

    const updateData = { ...request.body };
    if (updateData.totalAmount !== undefined) {
      const paid = Number(existing.paidAmountCents);
      updateData.totalAmountCents = updateData.totalAmount;
      updateData.remainingAmountCents = updateData.totalAmount - paid;
      delete updateData.totalAmount;
    }

    const [updatedDebt] = await app.db.update(debt)
      .set(updateData)
      .where(eq(debt.id, request.params.id))
      .returning();

    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(eq(debt.id, updatedDebt.id))
      .limit(1);

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'DEBT_UPDATED',
      entityType: 'Debt',
      entityId: updatedDebt.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...debtWithPerson!.debt,
      relatedPerson: debtWithPerson!.relatedPerson,
      totalAmount: { cents: Number(debtWithPerson!.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson!.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson!.debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.post('/:id/pay', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        amount: z.number().int().positive(),
        accountId: z.string().cuid().optional(),
        date: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { amount, accountId, date, notes } = request.body;
    const userId = request.authUser!.id;

    const [existing] = await app.db.select()
      .from(debt)
      .where(and(eq(debt.id, request.params.id), eq(debt.userId, userId)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Debt not found');
    if (amount > Number(existing.remainingAmountCents)) throw app.httpErrors.badRequest('Payment exceeds remaining amount');

    if (accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Account not found');

      await app.db.update(bankAccount)
        .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amount}` })
        .where(eq(bankAccount.id, accountId));
    }

    const newPaid = Number(existing.paidAmountCents) + amount;
    const newRemaining = Number(existing.totalAmountCents) - newPaid;
    const newStatus = newRemaining === 0 ? 'PAID' : 'ACTIVE';

    const [updatedDebt] = await app.db.update(debt)
      .set({
        paidAmountCents: newPaid,
        remainingAmountCents: newRemaining,
        status: newStatus,
      })
      .where(eq(debt.id, request.params.id))
      .returning();

    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(eq(debt.id, updatedDebt.id))
      .limit(1);

    if (accountId) {
      await app.db.insert(transaction).values({
        userId,
        description: `Pagamento dívida: ${debtWithPerson!.debt.description}`,
        amountCents: amount,
        type: 'EXPENSE',
        date: date ? new Date(date) : new Date(),
        paymentMethod: 'BANK_TRANSFER',
        accountId,
        notes: notes || `Pagamento de dívida - ${debtWithPerson!.debt.description}`,
      });
    }

    await app.auditLog({
      userId,
      action: 'DEBT_PAYMENT',
      entityType: 'Debt',
      entityId: updatedDebt.id,
      newData: { amount, accountId },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...debtWithPerson!.debt,
      relatedPerson: debtWithPerson!.relatedPerson,
      totalAmount: { cents: Number(debtWithPerson!.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson!.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson!.debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    await app.db.update(debt)
      .set({ status: 'CANCELLED' })
      .where(eq(debt.id, request.params.id));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'DEBT_CANCELLED',
      entityType: 'Debt',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.get('/owed', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, limit, startDate, endDate, status } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(person.userId, userId)];
    if (startDate) conditions.push(gte(debt.dueDate, new Date(startDate)));
    if (endDate) conditions.push(lte(debt.dueDate, new Date(endDate)));
    if (status) conditions.push(eq(debt.status, status));

    // Join debts with person where person.userId = userId
    const [debtsData, totalResult] = await Promise.all([
      app.db.select({
        ...debt,
        relatedPerson: person,
        sharedDebts: {
          id: sharedDebt.id,
          debtorUserId: sharedDebt.debtorUserId,
          creditorUserId: sharedDebt.creditorUserId,
          personId: sharedDebt.personId,
          status: sharedDebt.status,
          notifiedAt: sharedDebt.notifiedAt,
          acceptedAt: sharedDebt.acceptedAt,
          createdAt: sharedDebt.createdAt,
          updatedAt: sharedDebt.updatedAt,
          debtor: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled, settings: user.settings, createdAt: user.createdAt, updatedAt: user.updatedAt },
          creditor: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled, settings: user.settings, createdAt: user.createdAt, updatedAt: user.updatedAt },
        },
      })
        .from(debt)
        .innerJoin(person, eq(debt.relatedPersonId, person.id))
        .leftJoin(sharedDebt, eq(debt.id, sharedDebt.debtId))
        .leftJoin(user, eq(sharedDebt.debtorUserId, user.id))
        .leftJoin(user, eq(sharedDebt.creditorUserId, user.id))
        .where(and(...conditions))
        .orderBy(asc(debt.dueDate))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() })
        .from(debt)
        .innerJoin(person, eq(debt.relatedPersonId, person.id))
        .where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    const debtMap = new Map<string, any>();
    for (const d of debtsData) {
      if (!debtMap.has(d.debt.id)) {
        debtMap.set(d.debt.id, {
          ...d.debt,
          relatedPerson: d.relatedPerson,
          sharedDebts: [],
        });
      }
      if (d.sharedDebts.id) {
        debtMap.get(d.debt.id).sharedDebts.push(d.sharedDebts);
      }
    }

    return {
      data: Array.from(debtMap.values()).map((d) => ({
        ...d,
        totalAmount: { cents: Number(d.totalAmountCents), currency: 'BRL' as const },
        paidAmount: { cents: Number(d.paidAmountCents), currency: 'BRL' as const },
        remainingAmount: { cents: Number(d.remainingAmountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/owed', {
    schema: {
      body: z.object({
        description: z.string().min(1).max(200),
        totalAmount: z.number().int().positive(),
        dueDate: z.string().datetime(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']),
        personId: z.string().cuid(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { description, totalAmount, dueDate, type, personId, notes } = request.body;
    const userId = request.authUser!.id;

    const [personRecord] = await app.db.select()
      .from(person)
      .where(and(eq(person.id, personId), eq(person.userId, userId)))
      .limit(1);
    if (!personRecord) throw app.httpErrors.badRequest('Person not found');

    const [newDebt] = await app.db.insert(debt).values({
      userId,
      description,
      totalAmountCents: totalAmount,
      paidAmountCents: 0,
      remainingAmountCents: totalAmount,
      dueDate: new Date(dueDate),
      type,
      relatedPersonId: personId,
      notes,
      status: 'ACTIVE',
    }).returning();

    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(eq(debt.id, newDebt.id))
      .limit(1);

    await app.auditLog({
      userId,
      action: 'OWED_DEBT_CREATED',
      entityType: 'Debt',
      entityId: newDebt.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...debtWithPerson!.debt,
      relatedPerson: debtWithPerson!.relatedPerson,
      totalAmount: { cents: Number(debtWithPerson!.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson!.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson!.debt.remainingAmountCents), currency: 'BRL' as const },
    });
  });

  app.get('/owed/:id', {
    schema: { params: z.object({ id: z.string().cuid() }) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .innerJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(person.userId, request.authUser!.id)))
      .limit(1);

    if (!debtWithPerson) throw app.httpErrors.notFound('Debt not found');

    const sharedDebtsData = await app.db.select({
      ...sharedDebt,
      debtor: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled, settings: user.settings, createdAt: user.createdAt, updatedAt: user.updatedAt },
      creditor: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified, twoFactorEnabled: user.twoFactorEnabled, settings: user.settings, createdAt: user.createdAt, updatedAt: user.updatedAt },
    })
      .from(sharedDebt)
      .leftJoin(user, eq(sharedDebt.debtorUserId, user.id))
      .leftJoin(user, eq(sharedDebt.creditorUserId, user.id))
      .where(eq(sharedDebt.debtId, debtWithPerson.debt.id));

    return {
      ...debtWithPerson.debt,
      relatedPerson: debtWithPerson.relatedPerson,
      sharedDebts: sharedDebtsData,
      totalAmount: { cents: Number(debtWithPerson.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson.debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.patch('/owed/:id', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        totalAmount: z.number().int().positive().optional(),
        dueDate: z.string().datetime().optional(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']).optional(),
        notes: z.string().max(500).nullable().optional(),
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const [existing] = await app.db.select()
      .from(debt)
      .innerJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(person.userId, request.authUser!.id)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Debt not found');

    const updateData = { ...request.body };
    if (updateData.totalAmount !== undefined) {
      const paid = Number(existing.debt.paidAmountCents);
      updateData.totalAmountCents = updateData.totalAmount;
      updateData.remainingAmountCents = updateData.totalAmount - paid;
      delete updateData.totalAmount;
    }

    const [updatedDebt] = await app.db.update(debt)
      .set(updateData)
      .where(eq(debt.id, request.params.id))
      .returning();

    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(eq(debt.id, updatedDebt.id))
      .limit(1);

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'OWED_DEBT_UPDATED',
      entityType: 'Debt',
      entityId: updatedDebt.id,
      oldData: existing.debt,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...debtWithPerson!.debt,
      relatedPerson: debtWithPerson!.relatedPerson,
      totalAmount: { cents: Number(debtWithPerson!.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson!.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson!.debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.post('/owed/:id/pay', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        amount: z.number().int().positive(),
        date: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { amount, date, notes } = request.body;
    const userId = request.authUser!.id;

    const [existing] = await app.db.select()
      .from(debt)
      .innerJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(person.userId, userId)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Debt not found');
    if (amount > Number(existing.debt.remainingAmountCents)) throw app.httpErrors.badRequest('Payment exceeds remaining amount');

    const newPaid = Number(existing.debt.paidAmountCents) + amount;
    const newRemaining = Number(existing.debt.totalAmountCents) - newPaid;
    const newStatus = newRemaining === 0 ? 'PAID' : 'ACTIVE';

    const [updatedDebt] = await app.db.update(debt)
      .set({
        paidAmountCents: newPaid,
        remainingAmountCents: newRemaining,
        status: newStatus,
      })
      .where(eq(debt.id, request.params.id))
      .returning();

    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(eq(debt.id, updatedDebt.id))
      .limit(1);

    await app.auditLog({
      userId,
      action: 'OWED_DEBT_PAYMENT_RECEIVED',
      entityType: 'Debt',
      entityId: updatedDebt.id,
      newData: { amount },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...debtWithPerson!.debt,
      relatedPerson: debtWithPerson!.relatedPerson,
      totalAmount: { cents: Number(debtWithPerson!.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson!.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson!.debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.post('/owed/:id/share', {
    schema: {
      params: z.object({ id: z.string().cuid() }),
      body: z.object({
        email: z.string().email(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { email } = request.body;
    const userId = request.authUser!.id;

    const [debtWithPerson] = await app.db.select({
      ...debt,
      relatedPerson: person,
    })
      .from(debt)
      .innerJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(person.userId, userId)))
      .limit(1);
    if (!debtWithPerson) throw app.httpErrors.notFound('Debt not found');

    const [debtorUser] = await app.db.select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (debtorUser) {
      const [existingShare] = await app.db.select()
        .from(sharedDebt)
        .where(and(eq(sharedDebt.debtId, debtWithPerson.debt.id), eq(sharedDebt.debtorUserId, debtorUser.id)))
        .limit(1);
      if (existingShare) throw app.httpErrors.conflict('Debt already shared with this user');

      const [sharedDebtRecord] = await app.db.insert(sharedDebt).values({
        debtId: debtWithPerson.debt.id,
        debtorUserId: debtorUser.id,
        creditorUserId: userId,
        status: 'PENDING',
        notifiedAt: new Date(),
      }).returning();

      await app.db.insert(notification).values({
        userId: debtorUser.id,
        type: 'SHARED_DEBT_ADDED',
        title: 'Nova dívida compartilhada',
        message: `${request.authUser!.name} registrou uma dívida de ${(Number(debtWithPerson.debt.remainingAmountCents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em seu nome: ${debtWithPerson.debt.description}`,
        channels: ['IN_APP'],
        relatedEntityType: 'SharedDebt',
        relatedEntityId: sharedDebtRecord.id,
      });

      app.broadcast(debtorUser.id, {
        type: 'notification',
        data: { type: 'SHARED_DEBT_ADDED', debtId: debtWithPerson.debt.id, sharedDebtId: sharedDebtRecord.id },
      });
    } else {
      if (!debtWithPerson.relatedPerson?.email) {
        await app.db.update(person)
          .set({ email })
          .where(eq(person.id, debtWithPerson.relatedPersonId!));
      }
    }

    await app.auditLog({
      userId,
      action: 'DEBT_SHARED',
      entityType: 'Debt',
      entityId: debtWithPerson.debt.id,
      newData: { email },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true, shared: !!debtorUser };
  });
};

export default debtsRoutes;