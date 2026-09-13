import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, gte, lte, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { createDebtSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';
import { debt, person, sharedDebt, user, bankAccount, transaction, notification } from '../../db/schema/index.js';
import { emailSchema } from '@oxedindin/shared';

const debtorUser = alias(user, 'debts_debtor_user');
const creditorUser = alias(user, 'debts_creditor_user');

const debtsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, startDate, endDate, status, type } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(debt.userId, userId)];
    if (startDate) conditions.push(gte(debt.dueDate, new Date(startDate)));
    if (endDate) conditions.push(lte(debt.dueDate, new Date(endDate)));
    if (status) conditions.push(eq(debt.status, status));
    if (type) conditions.push(eq(debt.type, type));

    const [debtsData, totalResult] = await Promise.all([
      app.db.select({
        debt,
        relatedPerson: person,
      })
        .from(debt)
        .leftJoin(person, eq(debt.relatedPersonId, person.id))
        .where(and(...conditions))
        .orderBy(asc(debt.dueDate))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(debt).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    // Fetch shared debts separately and group them in JS
    const debtIds = debtsData.map((d) => d.debt.id);
    const sharedDebtsData = debtIds.length > 0
      ? await app.db.select({
          sharedDebt,
          debtor: debtorUser,
          creditor: creditorUser,
        })
          .from(sharedDebt)
          .leftJoin(debtorUser, eq(sharedDebt.debtorUserId, debtorUser.id))
          .leftJoin(creditorUser, eq(sharedDebt.creditorUserId, creditorUser.id))
          .where(inArray(sharedDebt.debtId, debtIds))
      : [];

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
    }
    for (const s of sharedDebtsData) {
      debtMap.get(s.sharedDebt.debtId)?.sharedDebts.push({
        ...s.sharedDebt,
        debtor: s.debtor,
      });
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
  }, async (request: any, reply: any) => {
    const { description, totalAmount, dueDate, type, relatedPersonId, notes } = request.body;
    const userId = request.authUser!.id;

    if (relatedPersonId) {
      const [personRecord] = await app.db.select()
        .from(person)
        .where(and(eq(person.id, relatedPersonId), eq(person.userId, userId)))
        .limit(1);
      if (!personRecord) throw app.httpErrors.badRequest('Pessoa não encontrada.');
    }

    const [newDebt] = await app.db.insert(debt).values({
      userId,
      description,
      totalAmountCents: totalAmount,
      paidAmountCents: 0n,
      remainingAmountCents: totalAmount,
      dueDate: new Date(dueDate),
      type,
      relatedPersonId,
      notes,
      status: 'ACTIVE',
    }).returning();

    const [debtWithPerson] = await app.db.select({
      debt,
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
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [debtWithPerson] = await app.db.select({
      debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(debt.userId, request.authUser!.id)))
      .limit(1);

    if (!debtWithPerson) throw app.httpErrors.notFound('Dívida não encontrada.');

    const sharedDebtsData = await app.db.select({
      sharedDebt,
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
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        totalAmount: z.number().int().positive().optional(),
        dueDate: z.string().datetime().optional(),
        type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']).optional(),
        relatedPersonId: z.string().uuid().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(debt)
      .where(and(eq(debt.id, request.params.id), eq(debt.userId, request.authUser!.id)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Dívida não encontrada.');

    const updateData = { ...request.body };
    if (updateData.totalAmount !== undefined) {
      const paid = Number(existing.paidAmountCents);
      updateData.totalAmountCents = BigInt(updateData.totalAmount);
      updateData.remainingAmountCents = BigInt(updateData.totalAmount - paid);
      delete updateData.totalAmount;
    }

    const [updatedDebt] = await app.db.update(debt)
      .set(updateData)
      .where(eq(debt.id, request.params.id))
      .returning();

    const [debtWithPerson] = await app.db.select({
      debt,
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
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        amount: z.number().int().positive(),
        accountId: z.string().uuid().optional(),
        date: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { amount, accountId, date, notes } = request.body;
    const userId = request.authUser!.id;

    const [existing] = await app.db.select()
      .from(debt)
      .where(and(eq(debt.id, request.params.id), eq(debt.userId, userId)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Dívida não encontrada.');
    if (amount > Number(existing.remainingAmountCents)) throw app.httpErrors.badRequest('O pagamento excede o valor restante.');

    if (accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Conta não encontrada.');

      await app.db.update(bankAccount)
        .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amount}` })
        .where(eq(bankAccount.id, accountId));
    }

    const newPaid = Number(existing.paidAmountCents) + amount;
    const newRemaining = Number(existing.totalAmountCents) - newPaid;
    const newStatus = newRemaining === 0 ? 'PAID' : 'ACTIVE';

    const [updatedDebt] = await app.db.update(debt)
      .set({
        paidAmountCents: BigInt(newPaid),
        remainingAmountCents: BigInt(newRemaining),
        status: newStatus,
      })
      .where(eq(debt.id, request.params.id))
      .returning();

    const [debtWithPerson] = await app.db.select({
      debt,
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
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(debt)
      .where(and(eq(debt.id, request.params.id), eq(debt.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Dívida não encontrada.');
    }

    if (Number(existing.paidAmountCents) > 0) {
      throw app.httpErrors.conflict('Não é possível excluir esta dívida porque existem pagamentos vinculados a ela.');
    }

    await app.db.delete(debt).where(eq(debt.id, request.params.id));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'DEBT_DELETED',
      entityType: 'Debt',
      entityId: request.params.id,
      oldData: existing,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/:id/link-person', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ email: emailSchema }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { email } = request.body;
    const userId = request.authUser!.id;

    const [existing] = await app.db.select()
      .from(debt)
      .where(and(eq(debt.id, request.params.id), eq(debt.userId, userId)))
      .limit(1);

    if (!existing) throw app.httpErrors.notFound('Dívida não encontrada.');

    const personRecord = await app.db.select()
      .from(person)
      .where(and(eq(person.userId, userId), eq(person.email, email)))
      .limit(1);

    let linkedPersonId = personRecord[0]?.id;

    if (!linkedPersonId) {
      const [newPerson] = await app.db.insert(person).values({
        userId,
        email,
        name: email,
        type: 'INDIVIDUAL',
      }).returning();
      linkedPersonId = newPerson.id;
    }

    await app.db.update(debt)
      .set({ relatedPersonId: linkedPersonId })
      .where(eq(debt.id, request.params.id));

    await app.auditLog({
      userId,
      action: 'DEBT_PERSON_LINKED',
      entityType: 'Debt',
      entityId: request.params.id,
      newData: { email, personId: linkedPersonId },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const [debtWithPerson] = await app.db.select({
      debt,
      relatedPerson: person,
    })
      .from(debt)
      .leftJoin(person, eq(debt.relatedPersonId, person.id))
      .where(eq(debt.id, request.params.id))
      .limit(1);

    return {
      ...debtWithPerson!.debt,
      relatedPerson: debtWithPerson!.relatedPerson,
      totalAmount: { cents: Number(debtWithPerson!.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson!.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson!.debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.get('/owed', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, startDate, endDate, status } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(person.userId, userId)];
    if (startDate) conditions.push(gte(debt.dueDate, new Date(startDate)));
    if (endDate) conditions.push(lte(debt.dueDate, new Date(endDate)));
    if (status) conditions.push(eq(debt.status, status));

    // Join debts with person where person.userId = userId
    const [debtsData, totalResult] = await Promise.all([
      app.db.select({
        debt,
        relatedPerson: person,
      })
        .from(debt)
        .innerJoin(person, eq(debt.relatedPersonId, person.id))
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

    const debtIds = debtsData.map((d) => d.debt.id);
    const sharedDebtsData = debtIds.length > 0
      ? await app.db.select({
          sharedDebt,
          debtor: debtorUser,
          creditor: creditorUser,
        })
          .from(sharedDebt)
          .leftJoin(debtorUser, eq(sharedDebt.debtorUserId, debtorUser.id))
          .leftJoin(creditorUser, eq(sharedDebt.creditorUserId, creditorUser.id))
          .where(inArray(sharedDebt.debtId, debtIds))
      : [];

    const debtMap = new Map<string, any>();
    for (const d of debtsData) {
      if (!debtMap.has(d.debt.id)) {
        debtMap.set(d.debt.id, {
          ...d.debt,
          relatedPerson: d.relatedPerson,
          sharedDebts: [],
        });
      }
    }
    for (const s of sharedDebtsData) {
      debtMap.get(s.sharedDebt.debtId)?.sharedDebts.push({
        ...s.sharedDebt,
        debtor: s.debtor,
      });
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
        personId: z.string().uuid(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { description, totalAmount, dueDate, type, personId, notes } = request.body;
    const userId = request.authUser!.id;

    const [personRecord] = await app.db.select()
      .from(person)
      .where(and(eq(person.id, personId), eq(person.userId, userId)))
      .limit(1);
    if (!personRecord) throw app.httpErrors.badRequest('Pessoa não encontrada.');

    const [newDebt] = await app.db.insert(debt).values({
      userId,
      description,
      totalAmountCents: totalAmount,
      paidAmountCents: 0n,
      remainingAmountCents: totalAmount,
      dueDate: new Date(dueDate),
      type,
      relatedPersonId: personId,
      notes,
      status: 'ACTIVE',
    }).returning();

    const [debtWithPerson] = await app.db.select({
      debt,
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
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [debtWithPerson] = await app.db.select({
      debt,
      relatedPerson: person,
    })
      .from(debt)
      .innerJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(person.userId, request.authUser!.id)))
      .limit(1);

    if (!debtWithPerson) throw app.httpErrors.notFound('Dívida não encontrada.');

    const sharedDebtsData = await app.db.select({
      sharedDebt,
      debtor: debtorUser,
      creditor: creditorUser,
    })
      .from(sharedDebt)
      .leftJoin(debtorUser, eq(sharedDebt.debtorUserId, debtorUser.id))
      .leftJoin(creditorUser, eq(sharedDebt.creditorUserId, creditorUser.id))
      .where(eq(sharedDebt.debtId, debtWithPerson.debt.id));

    return {
      ...debtWithPerson.debt,
      relatedPerson: debtWithPerson.relatedPerson,
      sharedDebts: sharedDebtsData.map((s) => ({
        ...s.sharedDebt,
        debtor: s.debtor,
      })),
      totalAmount: { cents: Number(debtWithPerson.debt.totalAmountCents), currency: 'BRL' as const },
      paidAmount: { cents: Number(debtWithPerson.debt.paidAmountCents), currency: 'BRL' as const },
      remainingAmount: { cents: Number(debtWithPerson.debt.remainingAmountCents), currency: 'BRL' as const },
    };
  });

  app.patch('/owed/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
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
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select({ debt, person })
      .from(debt)
      .innerJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(person.userId, request.authUser!.id)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Dívida não encontrada.');

    const updateData = { ...request.body };
    if (updateData.totalAmount !== undefined) {
      const paid = Number(existing.debt.paidAmountCents);
      updateData.totalAmountCents = BigInt(updateData.totalAmount);
      updateData.remainingAmountCents = BigInt(updateData.totalAmount - paid);
      delete updateData.totalAmount;
    }

    const [updatedDebt] = await app.db.update(debt)
      .set(updateData)
      .where(eq(debt.id, request.params.id))
      .returning();

    const [debtWithPerson] = await app.db.select({
      debt,
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
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        amount: z.number().int().positive(),
        date: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { amount, date, notes } = request.body;
    const userId = request.authUser!.id;

    const [existing] = await app.db.select({ debt, person })
      .from(debt)
      .innerJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(person.userId, userId)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Dívida não encontrada.');
    if (amount > Number(existing.debt.remainingAmountCents)) throw app.httpErrors.badRequest('O pagamento excede o valor restante.');

    const newPaid = Number(existing.debt.paidAmountCents) + amount;
    const newRemaining = Number(existing.debt.totalAmountCents) - newPaid;
    const newStatus = newRemaining === 0 ? 'PAID' : 'ACTIVE';

    const [updatedDebt] = await app.db.update(debt)
      .set({
        paidAmountCents: BigInt(newPaid),
        remainingAmountCents: BigInt(newRemaining),
        status: newStatus,
      })
      .where(eq(debt.id, request.params.id))
      .returning();

    const [debtWithPerson] = await app.db.select({
      debt,
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
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        email: emailSchema,
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { email } = request.body;
    const userId = request.authUser!.id;

    const [debtWithPerson] = await app.db.select({
      debt,
      relatedPerson: person,
    })
      .from(debt)
      .innerJoin(person, eq(debt.relatedPersonId, person.id))
      .where(and(eq(debt.id, request.params.id), eq(person.userId, userId)))
      .limit(1);
    if (!debtWithPerson) throw app.httpErrors.notFound('Dívida não encontrada.');

    const [debtorUser] = await app.db.select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (debtorUser) {
      const [existingShare] = await app.db.select()
        .from(sharedDebt)
        .where(and(eq(sharedDebt.debtId, debtWithPerson.debt.id), eq(sharedDebt.debtorUserId, debtorUser.id)))
        .limit(1);
      if (existingShare) throw app.httpErrors.conflict('Esta dívida já foi compartilhada com este usuário.');

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
          .where(eq(person.id, debtWithPerson.debt.relatedPersonId!));
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