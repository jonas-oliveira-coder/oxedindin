import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, desc, gte, lte, count, sum, sql } from 'drizzle-orm';
import { createTransactionSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';
import { transaction, bankAccount, creditCard, category, invoice, installmentPlan, installment } from '../../db/schema/index.js';

function calculateInstallmentValue(totalCents: number, count: number): number[] {
  const baseValue = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    values.push(baseValue + (i < remainder ? 1 : 0));
  }

  return values;
}

function getInvoicePeriod(date: Date, closingDay: number): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();

  let closingDate = new Date(year, month, closingDay);
  if (closingDate > date) {
    closingDate = new Date(year, month - 1, closingDay);
  }

  const periodStart = new Date(closingDate);
  periodStart.setDate(periodStart.getDate() + 1);

  const periodEnd = new Date(closingDate);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return { start: periodStart, end: periodEnd };
}

function getInvoiceForDate(date: Date, closingDay: number, dueDay: number): { closingDate: Date; dueDate: Date; periodStart: Date; periodEnd: Date } {
  const { start, end } = getInvoicePeriod(date, closingDay);

  const dueDate = new Date(end);
  dueDate.setDate(dueDay);
  if (dueDate <= end) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }

  const closingDate = new Date(end);

  return { closingDate, dueDate, periodStart: start, periodEnd: end };
}

const transactionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    schema: {
      querystring: paginationSchema.merge(dateRangeSchema).merge(z.object({
        categoryId: z.string().uuid().optional(),
        accountId: z.string().uuid().optional(),
        cardId: z.string().uuid().optional(),
        type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']).optional(),
      })),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { page, limit, startDate, endDate, categoryId, accountId, cardId, type } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(transaction.userId, userId)];
    if (startDate) conditions.push(gte(transaction.date, new Date(startDate)));
    if (endDate) conditions.push(lte(transaction.date, new Date(endDate)));
    if (categoryId) conditions.push(eq(transaction.categoryId, categoryId));
    if (accountId) conditions.push(eq(transaction.accountId, accountId));
    if (cardId) conditions.push(eq(transaction.cardId, cardId));
    if (type) conditions.push(eq(transaction.type, type));

    const [transactionsData, totalResult] = await Promise.all([
      app.db.select({
        transaction,
        category: category,
        account: bankAccount,
        card: creditCard,
      })
        .from(transaction)
        .leftJoin(category, eq(transaction.categoryId, category.id))
        .leftJoin(bankAccount, eq(transaction.accountId, bankAccount.id))
        .leftJoin(creditCard, eq(transaction.cardId, creditCard.id))
        .where(and(...conditions))
        .orderBy(desc(transaction.date))
        .limit(limit)
        .offset((page - 1) * limit),
      app.db.select({ count: count() }).from(transaction).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data: transactionsData.map((t) => ({
        ...t.transaction,
        amount: { cents: Number(t.transaction.amountCents), currency: 'BRL' as const },
        category: t.category,
        account: t.account,
        card: t.card,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  });

  app.get('/summary', {
    schema: {
      querystring: z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { month } = request.query;
    const userId = request.authUser!.id;

    const date = month ? new Date(`${month}-01`) : new Date();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

    const [expensesResult, incomeResult] = await Promise.all([
      app.db.select({ sum: sum(transaction.amountCents) })
        .from(transaction)
        .where(and(
          eq(transaction.userId, userId),
          eq(transaction.type, 'EXPENSE'),
          gte(transaction.date, startOfMonth),
          lte(transaction.date, endOfMonth)
        )),
      app.db.select({ sum: sum(transaction.amountCents) })
        .from(transaction)
        .where(and(
          eq(transaction.userId, userId),
          eq(transaction.type, 'INCOME'),
          gte(transaction.date, startOfMonth),
          lte(transaction.date, endOfMonth)
        )),
    ]);

    const expenses = Number(expensesResult[0]?.sum || 0);
    const income = Number(incomeResult[0]?.sum || 0);

    return {
      month: date.toISOString().slice(0, 7),
      expenses: { cents: expenses, currency: 'BRL' as const },
      income: { cents: income, currency: 'BRL' as const },
      balance: { cents: income - expenses, currency: 'BRL' as const },
    };
  });

  app.post('/', {
    schema: createTransactionSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { description, amount, type, categoryId, date, paymentMethod, accountId, cardId, notes } = request.body;
    const userId = request.authUser!.id;

    if (accountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Conta não encontrada.');
    }

    if (cardId) {
      const [card] = await app.db.select()
        .from(creditCard)
        .where(and(eq(creditCard.id, cardId), eq(creditCard.userId, userId)))
        .limit(1);
      if (!card) throw app.httpErrors.badRequest('Cartão não encontrado.');
    }

    if (categoryId) {
      const [cat] = await app.db.select()
        .from(category)
        .where(and(eq(category.id, categoryId), eq(category.userId, userId)))
        .limit(1);
      if (!cat) throw app.httpErrors.badRequest('Categoria não encontrada.');
    }

    const [newTransaction] = await app.db.insert(transaction).values({
      userId,
      description,
      amountCents: amount,
      type,
      categoryId,
      date: new Date(date),
      paymentMethod,
      accountId,
      cardId,
      notes,
    }).returning();

    if (accountId && type === 'EXPENSE') {
      await app.db.update(bankAccount)
        .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amount}` })
        .where(eq(bankAccount.id, accountId));
    } else if (accountId && type === 'INCOME') {
      await app.db.update(bankAccount)
        .set({ balanceCents: sql`${bankAccount.balanceCents} + ${amount}` })
        .where(eq(bankAccount.id, accountId));
    }

    if (cardId) {
      const [card] = await app.db.select()
        .from(creditCard)
        .where(eq(creditCard.id, cardId))
        .limit(1);
      if (card) {
        const { closingDate, dueDate, periodStart, periodEnd } = getInvoiceForDate(
          new Date(date),
          card.closingDay,
          card.dueDay
        );

        const [existingInvoice] = await app.db.select()
          .from(invoice)
          .where(and(eq(invoice.cardId, cardId), eq(invoice.periodStart, periodStart), eq(invoice.periodEnd, periodEnd)))
          .limit(1);

        let invoiceRecord = existingInvoice;
        if (!invoiceRecord) {
          const [newInvoice] = await app.db.insert(invoice).values({
            cardId,
            periodStart,
            periodEnd,
            closingDate,
            dueDate,
            totalCents: 0n,
            paidCents: 0n,
            remainingCents: 0n,
            status: 'OPEN',
          }).returning();
          invoiceRecord = newInvoice;
        }

        await app.db.update(invoice)
          .set({
            totalCents: sql`${invoice.totalCents} + ${amount}`,
            remainingCents: sql`${invoice.remainingCents} + ${amount}`,
          })
          .where(eq(invoice.id, invoiceRecord.id));

        await app.db.update(creditCard)
          .set({ availableLimitCents: sql`${creditCard.availableLimitCents} - ${amount}` })
          .where(eq(creditCard.id, cardId));

        await app.db.update(transaction)
          .set({ installmentPlanId: null })
          .where(eq(transaction.id, newTransaction.id));
      }
    }

    await app.auditLog({
      userId,
      action: 'TRANSACTION_CREATED',
      entityType: 'Transaction',
      entityId: newTransaction.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...newTransaction,
      amount: { cents: Number(newTransaction.amountCents), currency: 'BRL' as const },
    });
  });

  app.post('/installment', {
    schema: {
      body: z.object({
        description: z.string().min(1).max(200),
        totalAmount: z.number().int().positive(),
        installmentsCount: z.number().int().positive().max(60),
        startDate: z.string().datetime(),
        firstInvoiceDate: z.string().datetime(),
        cardId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const { description, totalAmount, installmentsCount, startDate, firstInvoiceDate, cardId, categoryId } = request.body;
    const userId = request.authUser!.id;

    const [card] = await app.db.select()
      .from(creditCard)
      .where(and(eq(creditCard.id, cardId), eq(creditCard.userId, userId)))
      .limit(1);
    if (!card) throw app.httpErrors.badRequest('Cartão não encontrado.');

    if (categoryId) {
      const [cat] = await app.db.select()
        .from(category)
        .where(and(eq(category.id, categoryId), eq(category.userId, userId)))
        .limit(1);
      if (!cat) throw app.httpErrors.badRequest('Categoria não encontrada.');
    }

    if (totalAmount > Number(card.availableLimitCents)) {
      throw app.httpErrors.badRequest('Limite disponível insuficiente.');
    }

    const installmentValues = calculateInstallmentValue(totalAmount, installmentsCount);
    const installmentValue = installmentValues[0];

    const [plan] = await app.db.insert(installmentPlan).values({
      userId,
      cardId,
      description,
      totalAmountCents: totalAmount,
      installmentsCount,
      installmentValueCents: BigInt(installmentValue),
      startDate: new Date(startDate),
      firstInvoiceDate: new Date(firstInvoiceDate),
      categoryId,
    }).returning();

    const createdInstallments = [];
    for (let i = 0; i < installmentsCount; i++) {
      const dueDate = new Date(firstInvoiceDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      const invoiceInfo = getInvoiceForDate(dueDate, card.closingDay, card.dueDay);

      const [existingInvoice] = await app.db.select()
        .from(invoice)
        .where(and(eq(invoice.cardId, cardId), eq(invoice.periodStart, invoiceInfo.periodStart), eq(invoice.periodEnd, invoiceInfo.periodEnd)))
        .limit(1);

      let invoiceRecord = existingInvoice;
      if (!invoiceRecord) {
        const [newInvoice] = await app.db.insert(invoice).values({
          cardId,
          periodStart: invoiceInfo.periodStart,
          periodEnd: invoiceInfo.periodEnd,
          closingDate: invoiceInfo.closingDate,
          dueDate: invoiceInfo.dueDate,
          totalCents: 0n,
          paidCents: 0n,
          remainingCents: 0n,
          status: 'OPEN',
        }).returning();
        invoiceRecord = newInvoice;
      }

      const [newInstallment] = await app.db.insert(installment).values({
        planId: plan.id,
        invoiceId: invoiceRecord.id,
        number: i + 1,
        amountCents: BigInt(installmentValues[i]),
        dueDate: invoiceInfo.dueDate,
        status: 'PENDING',
      }).returning();

      await app.db.update(invoice)
        .set({
          totalCents: sql`${invoice.totalCents} + ${installmentValues[i]}`,
          remainingCents: sql`${invoice.remainingCents} + ${installmentValues[i]}`,
        })
        .where(eq(invoice.id, invoiceRecord.id));

      createdInstallments.push(newInstallment);
    }

    await app.db.update(creditCard)
      .set({ availableLimitCents: sql`${creditCard.availableLimitCents} - ${totalAmount}` })
      .where(eq(creditCard.id, cardId));

    await app.auditLog({
      userId,
      action: 'INSTALLMENT_PLAN_CREATED',
      entityType: 'InstallmentPlan',
      entityId: plan.id,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      ...plan,
      totalAmount: { cents: Number(plan.totalAmountCents), currency: 'BRL' as const },
      installmentValue: { cents: Number(plan.installmentValueCents), currency: 'BRL' as const },
      installments: createdInstallments.map((i) => ({
        ...i,
        amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
      })),
    });
  });

  app.get('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [tx] = await app.db.select({
      transaction,
      category: category,
      account: bankAccount,
      card: creditCard,
    })
      .from(transaction)
      .leftJoin(category, eq(transaction.categoryId, category.id))
      .leftJoin(bankAccount, eq(transaction.accountId, bankAccount.id))
      .leftJoin(creditCard, eq(transaction.cardId, creditCard.id))
      .where(and(eq(transaction.id, request.params.id), eq(transaction.userId, request.authUser!.id)))
      .limit(1);

    if (!tx) {
      throw app.httpErrors.notFound('Transação não encontrada.');
    }

    return {
      ...tx.transaction,
      amount: { cents: Number(tx.transaction.amountCents), currency: 'BRL' as const },
      category: tx.category,
      account: tx.account,
      card: tx.card,
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        amount: z.number().int().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        date: z.string().datetime().optional(),
        paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const [existing] = await app.db.select()
      .from(transaction)
      .where(and(eq(transaction.id, request.params.id), eq(transaction.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Transação não encontrada.');
    }

    const { amount, date, ...updateRest } = request.body;
    const updateData: any = { ...updateRest };
    if (amount !== undefined) updateData.amountCents = amount;
    if (date !== undefined) updateData.date = new Date(date);

    const [updatedTransaction] = await app.db.update(transaction)
      .set(updateData)
      .where(eq(transaction.id, request.params.id))
      .returning();

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'TRANSACTION_UPDATED',
      entityType: 'Transaction',
      entityId: updatedTransaction.id,
      oldData: existing,
      newData: request.body,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      ...updatedTransaction,
      amount: { cents: Number(updatedTransaction.amountCents), currency: 'BRL' as const },
    };
  });

  app.delete('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
const [existing] = await app.db.select()
      .from(transaction)
      .where(and(eq(transaction.id, request.params.id), eq(transaction.userId, request.authUser!.id)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Transação não encontrada.');
    }

    if (existing.installmentPlanId || (existing.description && existing.description.startsWith('Pagamento'))) {
      throw app.httpErrors.conflict('Esta transação foi gerada por um pagamento e não pode ser excluída diretamente. Reverta o pagamento na origem.');
    }

    const amountCents = Number(existing.amountCents);

    if (existing.accountId) {
      if (existing.type === 'EXPENSE') {
        await app.db.update(bankAccount)
          .set({ balanceCents: sql`${bankAccount.balanceCents} + ${amountCents}` })
          .where(eq(bankAccount.id, existing.accountId));
      } else if (existing.type === 'INCOME') {
        await app.db.update(bankAccount)
          .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amountCents}` })
          .where(eq(bankAccount.id, existing.accountId));
      }
    }

    if (existing.cardId) {
      const [card] = await app.db.select()
        .from(creditCard)
        .where(eq(creditCard.id, existing.cardId))
        .limit(1);

      if (card) {
        const { periodStart, periodEnd } = getInvoiceForDate(new Date(existing.date), card.closingDay, card.dueDay);
        const [linkedInvoice] = await app.db.select()
          .from(invoice)
          .where(and(eq(invoice.cardId, existing.cardId), eq(invoice.periodStart, periodStart), eq(invoice.periodEnd, periodEnd)))
          .limit(1);

        if (linkedInvoice) {
          await app.db.update(invoice)
            .set({
              totalCents: sql`${invoice.totalCents} - ${amountCents}`,
              remainingCents: sql`${invoice.remainingCents} - ${amountCents}`,
            })
            .where(eq(invoice.id, linkedInvoice.id));
        }

        await app.db.update(creditCard)
          .set({ availableLimitCents: sql`${creditCard.availableLimitCents} + ${amountCents}` })
          .where(eq(creditCard.id, existing.cardId));
      }
    }

    await app.db.delete(transaction).where(eq(transaction.id, request.params.id));

    await app.auditLog({
      userId: request.authUser!.id,
      action: 'TRANSACTION_DELETED',
      entityType: 'Transaction',
      entityId: request.params.id,
      oldData: existing,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });
};

export default transactionsRoutes;