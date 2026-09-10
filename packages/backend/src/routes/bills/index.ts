import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, gte, lte, asc, count, sql, desc } from 'drizzle-orm';
import { createRecurringBillSchema, createBillSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';
import { recurringBill, bill, bankAccount, creditCard, category, transaction, user } from '../../db/schema/index.js';

function getNextDueDate(frequency: string, dueDay: number, fromDate: Date): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    case 'SEMIANNUAL':
      next.setMonth(next.getMonth() + 6);
      next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
    case 'ANNUAL':
      next.setFullYear(next.getFullYear() + 1);
      next.setDate(Math.min(dueDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      break;
  }
  return next;
}

const billsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/recurring', {
    schema: {
      querystring: paginationSchema.merge(z.object({
        status: z.enum(['ACTIVE', 'INACTIVE', 'ENDED']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, status } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(recurringBill.userId, userId)];
    if (status) conditions.push(eq(recurringBill.status, status));

    const [billsData, totalResult] = await Promise.all([
      app.db.select({
        recurringBill,
        category: category,
        account: bankAccount,
        card: creditCard,
      })
        .from(recurringBill)
        .leftJoin(category, eq(recurringBill.categoryId, category.id))
        .leftJoin(bankAccount, eq(recurringBill.accountId, bankAccount.id))
        .leftJoin(creditCard, eq(recurringBill.cardId, creditCard.id))
        .where(and(...conditions))
        .orderBy(asc(recurringBill.nextDueDate))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(recurringBill).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: billsData.map((b) => ({
        ...b.recurringBill,
        category: b.category,
        account: b.account,
        card: b.card,
        amount: { cents: Number(b.recurringBill.amountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/recurring', {
    schema: createRecurringBillSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { description, amount, categoryId, frequency, dueDay, startDate, endDate, accountId, cardId, dateType } = request.body;
    const userId = request.authUser!.id;

    if (accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Account not found');
    }
    if (cardId) {
      const [card] = await app.db.select()
        .from(creditCard)
        .where(and(eq(creditCard.id, cardId), eq(creditCard.userId, userId)))
        .limit(1);
      if (!card) throw app.httpErrors.badRequest('Card not found');
    }
    if (categoryId) {
      const [cat] = await app.db.select()
        .from(category)
        .where(and(eq(category.id, categoryId), eq(category.userId, userId)))
        .limit(1);
      if (!cat) throw app.httpErrors.badRequest('Category not found');
    }

    const nextDueDate = getNextDueDate(frequency, dueDay, new Date(startDate));

    const [newBill] = await app.db.insert(recurringBill).values({
      userId,
      description,
      amountCents: amount,
      categoryId,
      frequency,
      dueDay,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      nextDueDate,
      dateType: dateType || 'FIXED',
      accountId,
      cardId,
      status: 'ACTIVE',
    }).returning();

    const [billWithRelations] = await app.db.select({
      recurringBill,
      category: category,
      account: bankAccount,
      card: creditCard,
    })
      .from(recurringBill)
      .leftJoin(category, eq(recurringBill.categoryId, category.id))
      .leftJoin(bankAccount, eq(recurringBill.accountId, bankAccount.id))
      .leftJoin(creditCard, eq(recurringBill.cardId, creditCard.id))
      .where(eq(recurringBill.id, newBill.id))
      .limit(1);

    await app.auditLog({
      userId,
      action: 'RECURRING_BILL_CREATED',
      entityType: 'RecurringBill',
      entityId: newBill.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...billWithRelations!.recurringBill,
      category: billWithRelations!.category,
      account: billWithRelations!.account,
      card: billWithRelations!.card,
      amount: { cents: Number(billWithRelations!.recurringBill.amountCents), currency: 'BRL' as const },
    });
  });

  app.get('/recurring/:id', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [billWithRelations] = await app.db.select({
      recurringBill,
      category: category,
      account: bankAccount,
      card: creditCard,
    })
      .from(recurringBill)
      .leftJoin(category, eq(recurringBill.categoryId, category.id))
      .leftJoin(bankAccount, eq(recurringBill.accountId, bankAccount.id))
      .leftJoin(creditCard, eq(recurringBill.cardId, creditCard.id))
      .where(and(eq(recurringBill.id, request.params.id), eq(recurringBill.userId, request.authUser!.id)))
      .limit(1);

    if (!billWithRelations) throw app.httpErrors.notFound('Recurring bill not found');

    return {
      ...billWithRelations.recurringBill,
      category: billWithRelations.category,
      account: billWithRelations.account,
      card: billWithRelations.card,
      amount: { cents: Number(billWithRelations.recurringBill.amountCents), currency: 'BRL' as const },
    };
  });

  app.patch('/recurring/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        amount: z.number().int().positive().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']).optional(),
        dueDay: z.number().int().min(1).max(31).optional(),
        endDate: z.string().datetime().nullable().optional(),
        accountId: z.string().uuid().nullable().optional(),
        cardId: z.string().uuid().nullable().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ENDED']).optional(),
        dateType: z.enum(['FIXED', 'ADJUSTABLE']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(recurringBill)
      .where(and(eq(recurringBill.id, request.params.id), eq(recurringBill.userId, request.authUser!.id)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Recurring bill not found');

    const [updatedBill] = await app.db.update(recurringBill)
      .set(request.body)
      .where(eq(recurringBill.id, request.params.id))
      .returning();

    const [billWithRelations] = await app.db.select({
      recurringBill,
      category: category,
      account: bankAccount,
      card: creditCard,
    })
      .from(recurringBill)
      .leftJoin(category, eq(recurringBill.categoryId, category.id))
      .leftJoin(bankAccount, eq(recurringBill.accountId, bankAccount.id))
      .leftJoin(creditCard, eq(recurringBill.cardId, creditCard.id))
      .where(eq(recurringBill.id, updatedBill.id))
      .limit(1);

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'RECURRING_BILL_UPDATED',
      entityType: 'RecurringBill',
      entityId: updatedBill.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...billWithRelations!.recurringBill,
      category: billWithRelations!.category,
      account: billWithRelations!.account,
      card: billWithRelations!.card,
      amount: { cents: Number(billWithRelations!.recurringBill.amountCents), currency: 'BRL' as const },
    };
  });

  app.delete('/recurring/:id', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    await app.db.update(recurringBill)
      .set({ status: 'INACTIVE' })
      .where(eq(recurringBill.id, request.params.id));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'RECURRING_BILL_DEACTIVATED',
      entityType: 'RecurringBill',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  app.post('/recurring/:id/generate', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [recurringBillRecord] = await app.db.select()
      .from(recurringBill)
      .where(and(eq(recurringBill.id, request.params.id), eq(recurringBill.userId, request.authUser!.id)))
      .limit(1);
    if (!recurringBillRecord) throw app.httpErrors.notFound('Recurring bill not found');

    const [newBill] = await app.db.insert(bill).values({
      userId: request.authUser!.id,
      recurringBillId: recurringBillRecord.id,
      description: recurringBillRecord.description,
      amountCents: recurringBillRecord.amountCents,
      categoryId: recurringBillRecord.categoryId,
      dueDate: recurringBillRecord.nextDueDate,
      status: 'PENDING',
      accountId: recurringBillRecord.accountId,
    }).returning();

    const nextDueDate = getNextDueDate(
      recurringBillRecord.frequency,
      recurringBillRecord.dueDay,
      recurringBillRecord.nextDueDate
    );

    const updateData: any = { nextDueDate };
    if (recurringBillRecord.endDate && nextDueDate > recurringBillRecord.endDate) {
      updateData.status = 'ENDED';
    }

    await app.db.update(recurringBill)
      .set(updateData)
      .where(eq(recurringBill.id, recurringBillRecord.id));

    return { ...newBill, amount: { cents: Number(newBill.amountCents), currency: 'BRL' as const } };
  });

  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, startDate, endDate, status } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(bill.userId, userId)];
    if (startDate) conditions.push(gte(bill.dueDate, new Date(startDate)));
    if (endDate) conditions.push(lte(bill.dueDate, new Date(endDate)));
    if (status) conditions.push(eq(bill.status, status));

    const [billsData, totalResult] = await Promise.all([
      app.db.select({
        bill,
        category: category,
        account: bankAccount,
        recurringBill: recurringBill,
      })
        .from(bill)
        .leftJoin(category, eq(bill.categoryId, category.id))
        .leftJoin(bankAccount, eq(bill.accountId, bankAccount.id))
        .leftJoin(recurringBill, eq(bill.recurringBillId, recurringBill.id))
        .where(and(...conditions))
        .orderBy(asc(bill.dueDate))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(bill).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: billsData.map((b) => ({
        ...b.bill,
        category: b.category,
        account: b.account,
        recurringBill: b.recurringBill,
        amount: { cents: Number(b.bill.amountCents), currency: 'BRL' as const },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.post('/', {
    schema: createBillSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { description, amount, categoryId, dueDate, paymentMethod, accountId, notes } = request.body;
    const userId = request.authUser!.id;

    if (accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Account not found');
    }
    if (categoryId) {
      const [cat] = await app.db.select()
        .from(category)
        .where(and(eq(category.id, categoryId), eq(category.userId, userId)))
        .limit(1);
      if (!cat) throw app.httpErrors.badRequest('Category not found');
    }

    const [newBill] = await app.db.insert(bill).values({
      userId,
      description,
      amountCents: amount,
      categoryId,
      dueDate: new Date(dueDate),
      paymentMethod,
      accountId,
      notes,
      status: 'PENDING',
    }).returning();

    const [billWithRelations] = await app.db.select({
      bill,
      category: category,
      account: bankAccount,
    })
      .from(bill)
      .leftJoin(category, eq(bill.categoryId, category.id))
      .leftJoin(bankAccount, eq(bill.accountId, bankAccount.id))
      .where(eq(bill.id, newBill.id))
      .limit(1);

    await app.auditLog({
      userId,
      action: 'BILL_CREATED',
      entityType: 'Bill',
      entityId: newBill.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({ ...billWithRelations!.bill, category: billWithRelations!.category, account: billWithRelations!.account, amount: { cents: Number(billWithRelations!.bill.amountCents), currency: 'BRL' as const } });
  });

  app.get('/:id', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [billWithRelations] = await app.db.select({
      bill,
      category: category,
      account: bankAccount,
      recurringBill: recurringBill,
    })
      .from(bill)
      .leftJoin(category, eq(bill.categoryId, category.id))
      .leftJoin(bankAccount, eq(bill.accountId, bankAccount.id))
      .leftJoin(recurringBill, eq(bill.recurringBillId, recurringBill.id))
      .where(and(eq(bill.id, request.params.id), eq(bill.userId, request.authUser!.id)))
      .limit(1);

    if (!billWithRelations) throw app.httpErrors.notFound('Bill not found');

    return {
      ...billWithRelations.bill,
      category: billWithRelations.category,
      account: billWithRelations.account,
      recurringBill: billWithRelations.recurringBill,
      amount: { cents: Number(billWithRelations.bill.amountCents), currency: 'BRL' as const },
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        amount: z.number().int().positive().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        dueDate: z.string().datetime().optional(),
        paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).nullable().optional(),
        status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
        accountId: z.string().uuid().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(bill)
      .where(and(eq(bill.id, request.params.id), eq(bill.userId, request.authUser!.id)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Bill not found');

    const [updatedBill] = await app.db.update(bill)
      .set(request.body)
      .where(eq(bill.id, request.params.id))
      .returning();

    const [billWithRelations] = await app.db.select({
      bill,
      category: category,
      account: bankAccount,
      recurringBill: recurringBill,
    })
      .from(bill)
      .leftJoin(category, eq(bill.categoryId, category.id))
      .leftJoin(bankAccount, eq(bill.accountId, bankAccount.id))
      .leftJoin(recurringBill, eq(bill.recurringBillId, recurringBill.id))
      .where(eq(bill.id, updatedBill.id))
      .limit(1);

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'BILL_UPDATED',
      entityType: 'Bill',
      entityId: updatedBill.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...billWithRelations!.bill,
      category: billWithRelations!.category,
      account: billWithRelations!.account,
      recurringBill: billWithRelations!.recurringBill,
      amount: { cents: Number(billWithRelations!.bill.amountCents), currency: 'BRL' as const },
    };
  });

  app.post('/:id/pay', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        accountId: z.string().uuid().optional(),
        date: z.string().datetime().optional(),
        paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { accountId, date, paymentMethod } = request.body;
    const userId = request.authUser!.id;

    const [existing] = await app.db.select()
      .from(bill)
      .where(and(eq(bill.id, request.params.id), eq(bill.userId, userId)))
      .limit(1);
    if (!existing) throw app.httpErrors.notFound('Bill not found');
    if (existing.status === 'PAID') throw app.httpErrors.badRequest('Bill already paid');

    if (accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Account not found');

      await app.db.update(bankAccount)
        .set({ balanceCents: sql`${bankAccount.balanceCents} - ${existing.amountCents}` })
        .where(eq(bankAccount.id, accountId));
    }

    const [updatedBill] = await app.db.update(bill)
      .set({
        status: 'PAID',
        paidAt: date ? new Date(date) : new Date(),
        paymentMethod: paymentMethod || existing.paymentMethod,
        accountId: accountId || existing.accountId,
      })
      .where(eq(bill.id, request.params.id))
      .returning();

    const [billWithRelations] = await app.db.select({
      bill,
      category: category,
      account: bankAccount,
      recurringBill: recurringBill,
    })
      .from(bill)
      .leftJoin(category, eq(bill.categoryId, category.id))
      .leftJoin(bankAccount, eq(bill.accountId, bankAccount.id))
      .leftJoin(recurringBill, eq(bill.recurringBillId, recurringBill.id))
      .where(eq(bill.id, updatedBill.id))
      .limit(1);

    if (accountId) {
      await app.db.insert(transaction).values({
        userId,
        description: `Pagamento: ${billWithRelations!.bill.description}`,
        amountCents: billWithRelations!.bill.amountCents,
        type: 'EXPENSE',
        date: date ? new Date(date) : new Date(),
        paymentMethod: paymentMethod || 'BANK_TRANSFER',
        accountId,
        notes: `Pagamento de conta - ${billWithRelations!.bill.description}`,
      });
    }

    await app.auditLog({
      userId,
      action: 'BILL_PAID',
      entityType: 'Bill',
      entityId: updatedBill.id,
      newData: { accountId, paymentMethod },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { ...billWithRelations!.bill, category: billWithRelations!.category, account: billWithRelations!.account, recurringBill: billWithRelations!.recurringBill, amount: { cents: Number(billWithRelations!.bill.amountCents), currency: 'BRL' as const } };
  });

  app.delete('/:id', {
    schema: { params: z.object({ id: z.string().uuid() }) },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    await app.db.update(bill)
      .set({ status: 'CANCELLED' })
      .where(eq(bill.id, request.params.id));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'BILL_CANCELLED',
      entityType: 'Bill',
      entityId: request.params.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default billsRoutes;