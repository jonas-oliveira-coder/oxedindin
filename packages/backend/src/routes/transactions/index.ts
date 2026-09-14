import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, desc, gte, lte, count, sum, sql, inArray } from 'drizzle-orm';
import { createTransactionSchema, paginationSchema, dateRangeSchema } from '../../types/schemas.js';
import { transaction, bankAccount, creditCard, category, invoice, installmentPlan, installment, person, transactionSplit } from '../../db/schema/index.js';

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

async function createInstallmentPlan(app: any, input: {
  userId: string;
  description: string;
  totalAmount: number;
  installmentsCount: number;
  startDate: Date;
  firstInvoiceDate: Date;
  cardId: string;
  categoryId?: string | null;
}): Promise<{ plan: any; installments: any[] }> {
  const { userId, description, totalAmount, installmentsCount, startDate, firstInvoiceDate, cardId, categoryId } = input;

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
    startDate,
    firstInvoiceDate,
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

  return { plan, installments: createdInstallments };
}

async function loadSplitsForTransactions(app: any, transactionIds: string[]) {
  if (transactionIds.length === 0) return new Map<string, any[]>();
  const rows = await app.db.select({
    transactionSplit,
    person,
  })
    .from(transactionSplit)
    .leftJoin(person, eq(transactionSplit.personId, person.id))
    .where(inArray(transactionSplit.transactionId, transactionIds));

  const map = new Map<string, any[]>();
  for (const r of rows) {
    const split = {
      id: r.transactionSplit.id,
      personId: r.transactionSplit.personId,
      amount: { cents: Number(r.transactionSplit.amountCents), currency: 'BRL' as const },
      person: r.person,
    };
    const list = map.get(r.transactionSplit.transactionId) ?? [];
    list.push(split);
    map.set(r.transactionSplit.transactionId, list);
  }
  return map;
}

async function validateSplits(app: any, userId: string, amountCents: number, splits?: Array<{ personId: string; amountCents: number }>) {
  if (!splits || splits.length === 0) return;

  const total = splits.reduce((acc, s) => acc + s.amountCents, 0);
  if (total > amountCents) {
    throw app.httpErrors.badRequest('A soma das partes excede o valor da transação.');
  }

  const uniquePersonIds = new Set(splits.map((s) => s.personId));
  if (uniquePersonIds.size !== splits.length) {
    throw app.httpErrors.badRequest('Uma pessoa não pode aparecer mais de uma vez na divisão.');
  }

  for (const s of splits) {
    const [p] = await app.db.select()
      .from(person)
      .where(and(eq(person.id, s.personId), eq(person.userId, userId)))
      .limit(1);
    if (!p) throw app.httpErrors.badRequest('Pessoa não encontrada.');
  }
}

async function replaceSplits(app: any, userId: string, transactionId: string, splits?: Array<{ personId: string; amountCents: number }>) {
  await app.db.delete(transactionSplit).where(eq(transactionSplit.transactionId, transactionId));

  if (!splits || splits.length === 0) return [];

  const created = [];
  for (const s of splits) {
    const [row] = await app.db.insert(transactionSplit).values({
      userId,
      transactionId,
      personId: s.personId,
      amountCents: BigInt(s.amountCents),
    }).returning();
    created.push(row);
  }
  return created;
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

    const transactionIds = transactionsData.map((t) => t.transaction.id);
    const splitsByTransaction = await loadSplitsForTransactions(app, transactionIds);

    return {
      data: transactionsData.map((t) => {
        const splits = splitsByTransaction.get(t.transaction.id) ?? [];
        const splitTotalCents = splits.reduce((acc: number, s: any) => acc + s.amount.cents, 0);
        return {
          ...t.transaction,
          amount: { cents: Number(t.transaction.amountCents), currency: 'BRL' as const },
          category: t.category,
          account: t.account,
          card: t.card,
          splits,
          splitTotal: { cents: splitTotalCents, currency: 'BRL' as const },
        };
      }),
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
    const { description, amount, type, categoryId, date, paymentMethod, accountId, cardId, notes, installmentsCount, splits } = request.body;
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

    if (installmentsCount && installmentsCount > 1 && paymentMethod === 'CREDIT_CARD' && cardId) {
      const [cardForPlan] = await app.db.select()
        .from(creditCard)
        .where(and(eq(creditCard.id, cardId), eq(creditCard.userId, userId)))
        .limit(1);
      if (!cardForPlan) throw app.httpErrors.badRequest('Cartão não encontrado.');

      const purchaseDate = new Date(date);
      const firstInvoiceDate = getInvoiceForDate(purchaseDate, cardForPlan.closingDay, cardForPlan.dueDay).dueDate;

      const { plan, installments } = await createInstallmentPlan(app, {
        userId,
        description,
        totalAmount: amount,
        installmentsCount,
        startDate: purchaseDate,
        firstInvoiceDate,
        cardId,
        categoryId,
      });

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
        installments: installments.map((i: any) => ({
          ...i,
          amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
        })),
      });
    }

    await validateSplits(app, userId, amount, splits);

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

    await replaceSplits(app, userId, newTransaction.id, splits);

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

    const { plan, installments: createdInstallments } = await createInstallmentPlan(app, {
      userId,
      description,
      totalAmount,
      installmentsCount,
      startDate: new Date(startDate),
      firstInvoiceDate: new Date(firstInvoiceDate),
      cardId,
      categoryId,
    });

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

    const splitsByTransaction = await loadSplitsForTransactions(app, [tx.transaction.id]);
    const splits = splitsByTransaction.get(tx.transaction.id) ?? [];
    const splitTotalCents = splits.reduce((acc: number, s: any) => acc + s.amount.cents, 0);

    return {
      ...tx.transaction,
      amount: { cents: Number(tx.transaction.amountCents), currency: 'BRL' as const },
      category: tx.category,
      account: tx.account,
      card: tx.card,
      splits,
      splitTotal: { cents: splitTotalCents, currency: 'BRL' as const },
    };
  });

  app.patch('/:id', {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        description: z.string().min(1).max(200).optional(),
        amount: z.number().int().positive().optional(),
        type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']).optional(),
        categoryId: z.string().uuid().nullable().optional(),
        date: z.string().datetime().optional(),
        paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']).optional(),
        accountId: z.string().uuid().nullable().optional(),
        cardId: z.string().uuid().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        splits: z.array(z.object({
          personId: z.string().uuid(),
          amountCents: z.number().int().positive(),
        })).max(50).optional(),
      }),
    },
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.authUser!.id;
    const body = request.body;

    const [existing] = await app.db.select()
      .from(transaction)
      .where(and(eq(transaction.id, request.params.id), eq(transaction.userId, userId)))
      .limit(1);

    if (!existing) {
      throw app.httpErrors.notFound('Transação não encontrada.');
    }

    if (existing.installmentPlanId || (existing.description && existing.description.startsWith('Pagamento'))) {
      throw app.httpErrors.conflict('Esta transação foi gerada por um parcelamento e não pode ser editada diretamente. Gerencie-a na origem.');
    }

    const nextAccountId = body.accountId !== undefined ? body.accountId : existing.accountId;
    const nextCardId = body.cardId !== undefined ? body.cardId : existing.cardId;
    const nextType = body.type ?? existing.type;
    const nextAmount = body.amount !== undefined ? body.amount : Number(existing.amountCents);
    const nextDate = body.date !== undefined ? new Date(body.date) : new Date(existing.date);

    if (nextAccountId) {
      const [account] = await app.db.select()
        .from(bankAccount)
        .where(and(eq(bankAccount.id, nextAccountId), eq(bankAccount.userId, userId)))
        .limit(1);
      if (!account) throw app.httpErrors.badRequest('Conta não encontrada.');
    }

    if (nextCardId) {
      const [card] = await app.db.select()
        .from(creditCard)
        .where(and(eq(creditCard.id, nextCardId), eq(creditCard.userId, userId)))
        .limit(1);
      if (!card) throw app.httpErrors.badRequest('Cartão não encontrado.');
    }

    if (body.categoryId) {
      const [cat] = await app.db.select()
        .from(category)
        .where(and(eq(category.id, body.categoryId), eq(category.userId, userId)))
        .limit(1);
      if (!cat) throw app.httpErrors.badRequest('Categoria não encontrada.');
    }

    const oldAmount = Number(existing.amountCents);

    if (existing.accountId) {
      if (existing.type === 'EXPENSE') {
        await app.db.update(bankAccount)
          .set({ balanceCents: sql`${bankAccount.balanceCents} + ${oldAmount}` })
          .where(eq(bankAccount.id, existing.accountId));
      } else if (existing.type === 'INCOME') {
        await app.db.update(bankAccount)
          .set({ balanceCents: sql`${bankAccount.balanceCents} - ${oldAmount}` })
          .where(eq(bankAccount.id, existing.accountId));
      }
    }

    if (existing.cardId) {
      const [oldCard] = await app.db.select()
        .from(creditCard)
        .where(eq(creditCard.id, existing.cardId))
        .limit(1);
      if (oldCard) {
        const { periodStart, periodEnd } = getInvoiceForDate(new Date(existing.date), oldCard.closingDay, oldCard.dueDay);
        const [linkedInvoice] = await app.db.select()
          .from(invoice)
          .where(and(eq(invoice.cardId, existing.cardId), eq(invoice.periodStart, periodStart), eq(invoice.periodEnd, periodEnd)))
          .limit(1);
        if (linkedInvoice) {
          await app.db.update(invoice)
            .set({
              totalCents: sql`${invoice.totalCents} - ${oldAmount}`,
              remainingCents: sql`${invoice.remainingCents} - ${oldAmount}`,
            })
            .where(eq(invoice.id, linkedInvoice.id));
        }

        await app.db.update(creditCard)
          .set({ availableLimitCents: sql`${creditCard.availableLimitCents} + ${oldAmount}` })
          .where(eq(creditCard.id, existing.cardId));
      }
    }

    const updateData: any = {};
    if (body.description !== undefined) updateData.description = body.description;
    if (body.amount !== undefined) updateData.amountCents = body.amount;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    if (body.accountId !== undefined) updateData.accountId = body.accountId;
    if (body.cardId !== undefined) updateData.cardId = body.cardId;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const [updatedTransaction] = await app.db.update(transaction)
      .set(updateData)
      .where(eq(transaction.id, request.params.id))
      .returning();

    if (nextAccountId) {
      if (nextType === 'EXPENSE') {
        await app.db.update(bankAccount)
          .set({ balanceCents: sql`${bankAccount.balanceCents} - ${nextAmount}` })
          .where(eq(bankAccount.id, nextAccountId));
      } else if (nextType === 'INCOME') {
        await app.db.update(bankAccount)
          .set({ balanceCents: sql`${bankAccount.balanceCents} + ${nextAmount}` })
          .where(eq(bankAccount.id, nextAccountId));
      }
    }

    if (nextCardId) {
      const [newCard] = await app.db.select()
        .from(creditCard)
        .where(eq(creditCard.id, nextCardId))
        .limit(1);
      if (newCard) {
        const { closingDate, dueDate, periodStart, periodEnd } = getInvoiceForDate(nextDate, newCard.closingDay, newCard.dueDay);
        const [existingInvoice] = await app.db.select()
          .from(invoice)
          .where(and(eq(invoice.cardId, nextCardId), eq(invoice.periodStart, periodStart), eq(invoice.periodEnd, periodEnd)))
          .limit(1);

        let invoiceRecord = existingInvoice;
        if (!invoiceRecord) {
          const [newInvoice] = await app.db.insert(invoice).values({
            cardId: nextCardId,
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
            totalCents: sql`${invoice.totalCents} + ${nextAmount}`,
            remainingCents: sql`${invoice.remainingCents} + ${nextAmount}`,
          })
          .where(eq(invoice.id, invoiceRecord.id));

        await app.db.update(creditCard)
          .set({ availableLimitCents: sql`${creditCard.availableLimitCents} - ${nextAmount}` })
          .where(eq(creditCard.id, nextCardId));
      }
    }

    if (body.splits !== undefined) {
      await validateSplits(app, userId, nextAmount, body.splits);
      await replaceSplits(app, userId, updatedTransaction.id, body.splits);
    }

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