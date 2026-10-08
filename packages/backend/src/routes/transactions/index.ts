import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, desc, gte, lte, count, sum, sql, inArray } from 'drizzle-orm';
import { createTransactionSchema, paginationSchema, dateRangeSchema, dateInputSchema, bulkImportSchema } from '../../types/schemas.js';
import { transaction, bankAccount, creditCard, category, invoice, installmentPlan, installment, person, transactionSplit, bill, debt } from '../../db/schema/index.js';

import {
  getInvoiceCycle,
  getInvoiceCycleForDate,
  getInvoiceCycleFromDueDate,
  getOrCreateInvoiceForCycle,
  recalculateInvoice,
} from '../../services/invoice.service.js';

function calculateInstallmentValue(totalCents: number, count: number): number[] {
  const baseValue = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    values.push(baseValue + (i < remainder ? 1 : 0));
  }

  return values;
}

async function createInstallmentPlan(app: any, input: {
  userId: string;
  description: string;
  totalAmount: number;
  installmentsCount: number;
  startDate: Date;
  firstInvoiceDate?: Date;
  cardId: string;
  categoryId?: string | null;
}, db?: any): Promise<{ plan: any; installments: any[]; transactions: any[] }> {
  const dbOrTx = db || app.db;
  const { userId, description, totalAmount, installmentsCount, startDate, firstInvoiceDate, cardId, categoryId } = input;

  const [card] = await dbOrTx.select()
    .from(creditCard)
    .where(and(eq(creditCard.id, cardId), eq(creditCard.userId, userId)))
    .limit(1);
  if (!card) throw app.httpErrors.badRequest('Cartão não encontrado.');

  if (categoryId) {
    const [cat] = await dbOrTx.select()
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

  // Resolve starting invoice cycle:
  // If firstInvoiceDate differs significantly from startDate, resolve cycle from due date
  let firstCycle = getInvoiceCycleForDate(startDate, card.closingDay, card.dueDay);
  if (firstInvoiceDate && Math.abs(firstInvoiceDate.getTime() - startDate.getTime()) > 86400000 * 2) {
    firstCycle = getInvoiceCycleFromDueDate(firstInvoiceDate, card.closingDay, card.dueDay);
  }

  const [plan] = await dbOrTx.insert(installmentPlan).values({
    userId,
    cardId,
    description,
    totalAmountCents: totalAmount,
    installmentsCount,
    installmentValueCents: installmentValue,
    startDate,
    firstInvoiceDate: firstCycle.dueDate,
    categoryId,
  }).returning();

  const createdInstallments = [];
  const createdTransactions = [];
  for (let i = 0; i < installmentsCount; i++) {
    const cycle = getInvoiceCycle(firstCycle.cycleYear, firstCycle.cycleMonth + i, card.closingDay, card.dueDay);
    const invoiceRecord = await getOrCreateInvoiceForCycle(dbOrTx, card, cycle);

    const [newInstallment] = await dbOrTx.insert(installment).values({
      planId: plan.id,
      invoiceId: invoiceRecord.id,
      number: i + 1,
      amountCents: installmentValues[i],
      dueDate: cycle.dueDate,
      status: 'PENDING',
    }).returning();

    const installmentDate = (i === 0 && startDate) ? startDate : cycle.dueDate;
    const [txRecord] = await dbOrTx.insert(transaction).values({
      userId,
      description: `${description} (${i + 1}/${installmentsCount})`,
      amountCents: installmentValues[i],
      type: 'EXPENSE',
      categoryId,
      date: installmentDate,
      paymentMethod: 'CREDIT_CARD',
      cardId,
      invoiceId: invoiceRecord.id,
      installmentPlanId: plan.id,
      notes: `Parcela ${i + 1} de ${installmentsCount}`,
    }).returning();

    await recalculateInvoice(dbOrTx, invoiceRecord.id);
    createdInstallments.push(newInstallment);
    createdTransactions.push(txRecord);
  }

  await dbOrTx.update(creditCard)
    .set({ availableLimitCents: sql`${creditCard.availableLimitCents} - ${totalAmount}` })
    .where(eq(creditCard.id, cardId));

  return { plan, installments: createdInstallments, transactions: createdTransactions };
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

  for (const s of splits) {
    if (!Number.isFinite(s.amountCents) || s.amountCents <= 0) {
      throw app.httpErrors.badRequest('O valor da parte de cada pessoa deve ser maior que zero.');
    }
  }

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

      const { plan, installments, transactions: planTransactions } = await createInstallmentPlan(app, {
        userId,
        description,
        totalAmount: amount,
        installmentsCount,
        startDate: purchaseDate,
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
        transactions: planTransactions.map((t: any) => ({
          ...t,
          amount: { cents: Number(t.amountCents), currency: 'BRL' as const },
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
        const cycle = getInvoiceCycleForDate(new Date(date), card.closingDay, card.dueDay);
        const invoiceRecord = await getOrCreateInvoiceForCycle(app.db, card, cycle);

        await app.db.update(creditCard)
          .set({ availableLimitCents: sql`${creditCard.availableLimitCents} - ${amount}` })
          .where(eq(creditCard.id, cardId));

        await app.db.update(transaction)
          .set({ invoiceId: invoiceRecord.id })
          .where(eq(transaction.id, newTransaction.id));

        await recalculateInvoice(app.db, invoiceRecord.id);
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
        startDate: dateInputSchema,
        firstInvoiceDate: dateInputSchema,
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

  app.post('/bulk-import', {
    schema: bulkImportSchema,
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    const userId = request.authUser.id;
    const body = request.body as z.infer<typeof bulkImportSchema.shape.body>;

    const toCentsVal = (val: number | string | undefined | null, fallbackCents?: number): number => {
      if (fallbackCents !== undefined && Number.isInteger(fallbackCents)) {
        return fallbackCents;
      }
      if (typeof val === 'number') {
        return Math.round(val * 100);
      }
      if (typeof val === 'string') {
        const cleaned = val.replace(/[R$\s]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (!isNaN(num)) return Math.round(num * 100);
      }
      return 0;
    };

    const parseDateVal = (dateStr: string): Date => {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    const result = await app.db.transaction(async (tx: any) => {
      // 1. Pessoas
      const existingPeople = await tx.select().from(person).where(eq(person.userId, userId));
      const peopleMap = new Map<string, string>();
      for (const p of existingPeople) {
        peopleMap.set(p.name.trim().toLowerCase(), p.id);
      }
      let createdPeopleCount = 0;
      for (const p of body.people || []) {
        const key = p.name.trim().toLowerCase();
        if (!peopleMap.has(key)) {
          const [created] = await tx.insert(person).values({
            userId,
            name: p.name.trim(),
            email: p.email || null,
            phone: p.phone || null,
            notes: p.notes || null,
          }).returning();
          peopleMap.set(key, created.id);
          createdPeopleCount++;
        }
      }

      // 2. Categorias
      const existingCategories = await tx.select().from(category).where(eq(category.userId, userId));
      const categoriesMap = new Map<string, string>();
      for (const c of existingCategories) {
        categoriesMap.set(c.name.trim().toLowerCase(), c.id);
      }
      let createdCategoriesCount = 0;
      for (const c of body.categories || []) {
        const key = c.name.trim().toLowerCase();
        if (!categoriesMap.has(key)) {
          const [created] = await tx.insert(category).values({
            userId,
            name: c.name.trim(),
            color: c.color || null,
            icon: c.icon || null,
          }).returning();
          categoriesMap.set(key, created.id);
          createdCategoriesCount++;
        }
      }

      // 3. Contas Bancárias
      const existingAccounts = await tx.select().from(bankAccount).where(eq(bankAccount.userId, userId));
      const accountsMap = new Map<string, string>();
      for (const a of existingAccounts) {
        accountsMap.set(a.name.trim().toLowerCase(), a.id);
      }
      let createdAccountsCount = 0;
      for (const a of body.bankAccounts || []) {
        const key = a.name.trim().toLowerCase();
        if (!accountsMap.has(key)) {
          const initialBalanceCents = toCentsVal(a.initialBalance, a.initialBalanceCents);
          const [created] = await tx.insert(bankAccount).values({
            userId,
            name: a.name.trim(),
            institution: a.institution.trim() || 'Outro',
            type: a.type || 'CHECKING',
            number: a.number || null,
            agency: a.agency || null,
            initialBalanceCents,
            balanceCents: initialBalanceCents,
            notes: a.notes || null,
          }).returning();
          accountsMap.set(key, created.id);
          createdAccountsCount++;
        }
      }

      // 4. Cartões de Crédito
      const existingCards = await tx.select().from(creditCard).where(eq(creditCard.userId, userId));
      const cardsMap = new Map<string, string>();
      for (const c of existingCards) {
        cardsMap.set(c.name.trim().toLowerCase(), c.id);
      }
      let createdCardsCount = 0;
      for (const c of body.creditCards || []) {
        const key = c.name.trim().toLowerCase();
        if (!cardsMap.has(key)) {
          const limitCents = toCentsVal(c.limit, c.limitCents) || 500000;
          const linkedAccountId = c.accountName ? accountsMap.get(c.accountName.trim().toLowerCase()) || null : null;
          const [created] = await tx.insert(creditCard).values({
            userId,
            name: c.name.trim(),
            institution: c.institution.trim() || 'Outro',
            brand: c.brand || 'MASTERCARD',
            last4: '0000',
            limitCents,
            availableLimitCents: limitCents,
            closingDay: c.closingDay || 25,
            dueDay: c.dueDay || 5,
            accountId: linkedAccountId,
            notes: c.notes || null,
          }).returning();
          cardsMap.set(key, created.id);
          createdCardsCount++;
        }
      }

      // 5. Transações
      // 5. Transações & Parcelamentos
      let createdTransactionsCount = 0;
      let createdInstallmentPlansCount = 0;
      let createdSplitsCount = 0;
      for (const t of body.transactions || []) {
        const amount = toCentsVal(t.amount, t.amountCents);
        if (amount <= 0) continue;

        const linkedAccountId = t.accountName ? accountsMap.get(t.accountName.trim().toLowerCase()) || null : null;
        const linkedCardId = t.cardName ? cardsMap.get(t.cardName.trim().toLowerCase()) || null : null;
        const linkedCategoryId = t.categoryName ? categoriesMap.get(t.categoryName.trim().toLowerCase()) || null : null;
        const tDate = parseDateVal(t.date);

        // Se for compra parcelada no cartão de crédito
        if (t.installmentsCount && t.installmentsCount > 1 && linkedCardId) {
          const [cardForPlan] = await tx.select().from(creditCard).where(eq(creditCard.id, linkedCardId)).limit(1);
          if (cardForPlan) {
            const { transactions: planTxs } = await createInstallmentPlan(app, {
              userId,
              description: t.description.trim(),
              totalAmount: amount,
              installmentsCount: t.installmentsCount,
              startDate: tDate,
              cardId: linkedCardId,
              categoryId: linkedCategoryId,
            }, tx);
            createdInstallmentPlansCount++;
            createdTransactionsCount += (planTxs?.length || 0);
            continue;
          }
        }

        const [newTx] = await tx.insert(transaction).values({
          userId,
          description: t.description.trim(),
          amountCents: amount,
          type: t.type || 'EXPENSE',
          categoryId: linkedCategoryId,
          date: tDate,
          paymentMethod: t.paymentMethod || 'PIX',
          accountId: linkedAccountId,
          cardId: linkedCardId,
          notes: t.notes || null,
        }).returning();
        createdTransactionsCount++;

        // Splits / Divisão de contas com pessoas
        if (t.splits && t.splits.length > 0) {
          for (const s of t.splits) {
            const sNameKey = s.personName.trim().toLowerCase();
            let sPersonId = peopleMap.get(sNameKey);
            if (!sPersonId) {
              const [newP] = await tx.insert(person).values({
                userId,
                name: s.personName.trim(),
                type: 'INDIVIDUAL',
              }).returning();
              sPersonId = newP.id;
              peopleMap.set(sNameKey, sPersonId);
              createdPeopleCount++;
            }
            const sAmount = toCentsVal(s.amount, s.amountCents);
            if (sAmount > 0) {
              await tx.insert(transactionSplit).values({
                userId,
                transactionId: newTx.id,
                personId: sPersonId,
                amountCents: sAmount,
              });
              createdSplitsCount++;
            }
          }
        }

        // Atualizar saldo da conta bancária
        if (linkedAccountId && t.type === 'EXPENSE') {
          await tx.update(bankAccount)
            .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amount}` })
            .where(eq(bankAccount.id, linkedAccountId));
        } else if (linkedAccountId && t.type === 'INCOME') {
          await tx.update(bankAccount)
            .set({ balanceCents: sql`${bankAccount.balanceCents} + ${amount}` })
            .where(eq(bankAccount.id, linkedAccountId));
        }

        // Atualizar fatura e limite do cartão
        if (linkedCardId) {
          const [card] = await tx.select().from(creditCard).where(eq(creditCard.id, linkedCardId)).limit(1);
          if (card) {
            const cycle = getInvoiceCycleForDate(tDate, card.closingDay, card.dueDay);
            const invRecord = await getOrCreateInvoiceForCycle(tx, card, cycle);

            await tx.update(creditCard)
              .set({ availableLimitCents: sql`${creditCard.availableLimitCents} - ${amount}` })
              .where(eq(creditCard.id, linkedCardId));

            await tx.update(transaction)
              .set({ invoiceId: invRecord.id })
              .where(eq(transaction.id, newTx.id));

            await recalculateInvoice(tx, invRecord.id);
          }
        }
      }

      // 6. Contas a Pagar (Bills)
      let createdBillsCount = 0;
      for (const b of body.bills || []) {
        const amount = toCentsVal(b.amount, b.amountCents);
        if (amount <= 0) continue;

        const linkedCategoryId = b.categoryName ? categoriesMap.get(b.categoryName.trim().toLowerCase()) || null : null;
        const linkedAccountId = b.accountName ? accountsMap.get(b.accountName.trim().toLowerCase()) || null : null;
        const bDueDate = parseDateVal(b.dueDate);

        await tx.insert(bill).values({
          userId,
          description: b.description.trim(),
          amountCents: amount,
          dueDate: bDueDate,
          status: b.status || 'PENDING',
          paymentMethod: b.paymentMethod || null,
          categoryId: linkedCategoryId,
          accountId: linkedAccountId,
          notes: b.notes || null,
        });
        createdBillsCount++;
      }

      // 7. Dívidas (Debts)
      let createdDebtsCount = 0;
      for (const d of body.debts || []) {
        const totalAmount = toCentsVal(d.totalAmount, d.totalAmountCents);
        if (totalAmount <= 0) continue;

        const linkedPersonId = d.personName ? peopleMap.get(d.personName.trim().toLowerCase()) || null : null;
        const dDueDate = parseDateVal(d.dueDate);

        await tx.insert(debt).values({
          userId,
          description: d.description.trim(),
          totalAmountCents: totalAmount,
          paidAmountCents: 0,
          remainingAmountCents: totalAmount,
          dueDate: dDueDate,
          type: d.type || 'BORROWED_MONEY',
          relatedPersonId: linkedPersonId,
          status: 'ACTIVE',
          notes: d.notes || null,
        });
        createdDebtsCount++;
      }

      return {
        bankAccounts: createdAccountsCount,
        creditCards: createdCardsCount,
        categories: createdCategoriesCount,
        people: createdPeopleCount,
        transactions: createdTransactionsCount,
        installmentPlans: createdInstallmentPlansCount,
        splits: createdSplitsCount,
        bills: createdBillsCount,
        debts: createdDebtsCount,
      };
    });

    await app.auditLog({
      userId,
      action: 'BULK_IMPORT',
      entityType: 'System',
      entityId: userId,
      newData: result,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(201).send({
      success: true,
      imported: result,
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
        date: dateInputSchema.optional(),
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

    if (existing.description && existing.description.startsWith('Pagamento parcela')) {
      throw app.httpErrors.conflict('Esta transação foi gerada por um pagamento de parcela e não pode ser editada diretamente. Gerencie-a na origem.');
    }

    if (existing.installmentPlanId) {
      if (body.amount !== undefined && body.amount !== Number(existing.amountCents)) {
        throw app.httpErrors.badRequest('O valor da parcela não pode ser alterado diretamente. Gerencie na aba de parcelamentos.');
      }
      if (body.type !== undefined && body.type !== existing.type) {
        throw app.httpErrors.badRequest('O tipo de parcelas do cartão não pode ser alterado.');
      }
      if (body.cardId !== undefined && body.cardId !== existing.cardId) {
        throw app.httpErrors.badRequest('O cartão vinculado ao parcelamento não pode ser alterado individualmente.');
      }
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
      await app.db.update(creditCard)
        .set({ availableLimitCents: sql`${creditCard.availableLimitCents} + ${oldAmount}` })
        .where(eq(creditCard.id, existing.cardId));
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

    let newInvoiceRecordId: string | null = null;
    if (nextCardId) {
      const [newCard] = await app.db.select()
        .from(creditCard)
        .where(eq(creditCard.id, nextCardId))
        .limit(1);
      if (newCard) {
        const cycle = getInvoiceCycleForDate(nextDate, newCard.closingDay, newCard.dueDay);
        const invoiceRecord = await getOrCreateInvoiceForCycle(app.db, newCard, cycle);
        newInvoiceRecordId = invoiceRecord.id;

        await app.db.update(creditCard)
          .set({ availableLimitCents: sql`${creditCard.availableLimitCents} - ${nextAmount}` })
          .where(eq(creditCard.id, nextCardId));

        await app.db.update(transaction)
          .set({ invoiceId: invoiceRecord.id })
          .where(eq(transaction.id, updatedTransaction.id));

        await recalculateInvoice(app.db, invoiceRecord.id);
      }
    } else if (existing.cardId && !nextCardId) {
      await app.db.update(transaction)
        .set({ invoiceId: null })
        .where(eq(transaction.id, updatedTransaction.id));
    }

    if (existing.invoiceId && existing.invoiceId !== newInvoiceRecordId) {
      await recalculateInvoice(app.db, existing.invoiceId);
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

    if (existing.description && existing.description.startsWith('Pagamento parcela')) {
      throw app.httpErrors.conflict('Esta transação foi gerada por um pagamento de parcela e não pode ser excluída diretamente. Reverta o pagamento na aba de parcelamentos.');
    }

    const amountCents = Number(existing.amountCents);

    // Se for uma parcela de cartão de crédito vinculada a um plano
    if (existing.installmentPlanId) {
      if (existing.invoiceId) {
        const [matchingInst] = await app.db.select()
          .from(installment)
          .where(and(
            eq(installment.planId, existing.installmentPlanId),
            eq(installment.invoiceId, existing.invoiceId)
          ))
          .limit(1);

        if (matchingInst) {
          await app.db.delete(installment).where(eq(installment.id, matchingInst.id));
        }
      }
    }

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
      await app.db.update(creditCard)
        .set({ availableLimitCents: sql`${creditCard.availableLimitCents} + ${amountCents}` })
        .where(eq(creditCard.id, existing.cardId));
    }

    const invoiceIdToRecalculate = existing.invoiceId;

    await app.db.delete(transaction).where(eq(transaction.id, request.params.id));

    if (invoiceIdToRecalculate) {
      await recalculateInvoice(app.db, invoiceIdToRecalculate);
    }

    if (existing.installmentPlanId) {
      const [remainingTxs] = await app.db.select({ count: count() })
        .from(transaction)
        .where(eq(transaction.installmentPlanId, existing.installmentPlanId));

      if (Number(remainingTxs?.count || 0) === 0) {
        await app.db.delete(installmentPlan).where(eq(installmentPlan.id, existing.installmentPlanId));
      }
    }

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