import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq, and, gte, lte, asc, count, sum, sql, inArray, not, isNull } from 'drizzle-orm';
import { reportFiltersSchema } from '../../types/schemas.js';
import { transaction, category, bankAccount, creditCard, installment, installmentPlan, recurringBill, debt, person, invoice, bill } from '../../db/schema';

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

const reportsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/spending-by-category', {
    schema: { querystring: reportFiltersSchema.shape.query },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { startDate, endDate, categoryIds, accountIds, cardIds, transactionTypes } = request.query;
    const userId = request.authUser!.id;

    const conditions = [
      eq(transaction.userId, userId),
      eq(transaction.type, 'EXPENSE'),
    ];
    if (startDate) conditions.push(gte(transaction.date, new Date(startDate)));
    if (endDate) conditions.push(lte(transaction.date, new Date(endDate)));
    if (categoryIds) conditions.push(inArray(transaction.categoryId, categoryIds));
    if (accountIds) conditions.push(inArray(transaction.accountId, accountIds));
    if (cardIds) conditions.push(inArray(transaction.cardId, cardIds));
    if (transactionTypes) conditions.push(inArray(transaction.type, transactionTypes));

    const transactionsData = await app.db.select({
      ...transaction,
      category: category,
    })
      .from(transaction)
      .leftJoin(category, eq(transaction.categoryId, category.id))
      .where(and(...conditions));

    const categoryMap = new Map<string, { total: number; count: number; category: any }>();
    let grandTotal = 0;

    for (const t of transactionsData) {
      const catId = t.transaction.categoryId || 'uncategorized';
      const cat = t.category || { name: 'Sem categoria', color: '#6B7280' };
      const existing = categoryMap.get(catId) || { total: 0, count: 0, category: cat };
      existing.total += Number(t.transaction.amountCents);
      existing.count += 1;
      categoryMap.set(catId, existing);
      grandTotal += Number(t.transaction.amountCents);
    }

    return Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.category.name,
      categoryColor: data.category.color,
      total: { cents: data.total, currency: 'BRL' as const },
      percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      transactionCount: data.count,
    })).sort((a, b) => b.total.cents - a.total.cents);
  });

  app.get('/spending-by-period', {
    schema: { querystring: reportFiltersSchema.shape.query.merge(z.object({ interval: z.enum(['day', 'week', 'month']).default('month') })) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { startDate, endDate, interval } = request.query;
    const userId = request.authUser!.id;

    const conditions = [eq(transaction.userId, userId)];
    if (startDate) conditions.push(gte(transaction.date, new Date(startDate)));
    if (endDate) conditions.push(lte(transaction.date, new Date(endDate)));

    const transactionsData = await app.db.select()
      .from(transaction)
      .where(and(...conditions))
      .orderBy(asc(transaction.date));

    const periodMap = new Map<string, { expenses: number; income: number }>();

    for (const t of transactionsData) {
      let key: string;
      const date = new Date(t.date);

      if (interval === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (interval === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = getMonthKey(date);
      }

      const existing = periodMap.get(key) || { expenses: 0, income: 0 };
      if (t.type === 'EXPENSE') existing.expenses += Number(t.amountCents);
      else if (t.type === 'INCOME') existing.income += Number(t.amountCents);
      periodMap.set(key, existing);
    }

    return Array.from(periodMap.entries())
      .map(([period, data]) => ({
        period,
        total: { cents: data.expenses + data.income, currency: 'BRL' as const },
        expenses: { cents: data.expenses, currency: 'BRL' as const },
        income: { cents: data.income, currency: 'BRL' as const },
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  });

  app.get('/spending-by-account', {
    schema: { querystring: reportFiltersSchema.shape.query },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { startDate, endDate, categoryIds, accountIds, cardIds, transactionTypes } = request.query;
    const userId = request.authUser!.id;

    const conditions = [
      eq(transaction.userId, userId),
      eq(transaction.type, 'EXPENSE'),
    ];
    if (startDate) conditions.push(gte(transaction.date, new Date(startDate)));
    if (endDate) conditions.push(lte(transaction.date, new Date(endDate)));
    if (categoryIds) conditions.push(inArray(transaction.categoryId, categoryIds));
    if (accountIds) conditions.push(inArray(transaction.accountId, accountIds));
    if (cardIds) conditions.push(inArray(transaction.cardId, cardIds));
    if (transactionTypes) conditions.push(inArray(transaction.type, transactionTypes));

    const transactionsData = await app.db.select({
      ...transaction,
      account: bankAccount,
    })
      .from(transaction)
      .leftJoin(bankAccount, eq(transaction.accountId, bankAccount.id))
      .where(and(...conditions));

    const accountMap = new Map<string, { total: number; count: number; name: string }>();

    for (const t of transactionsData) {
      const accId = t.transaction.accountId || 'no-account';
      const name = t.account?.name || 'Sem conta';
      const existing = accountMap.get(accId) || { total: 0, count: 0, name };
      existing.total += Number(t.transaction.amountCents);
      existing.count += 1;
      accountMap.set(accId, existing);
    }

    return Array.from(accountMap.entries()).map(([accountId, data]) => ({
      accountId,
      accountName: data.name,
      total: { cents: data.total, currency: 'BRL' as const },
      transactionCount: data.count,
    })).sort((a, b) => b.total.cents - a.total.cents);
  });

  app.get('/spending-by-card', {
    schema: { querystring: reportFiltersSchema.shape.query },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { startDate, endDate, categoryIds, accountIds, cardIds, transactionTypes } = request.query;
    const userId = request.authUser!.id;

    const conditions = [
      eq(transaction.userId, userId),
      eq(transaction.type, 'EXPENSE'),
      not(isNull(transaction.cardId)),
    ];
    if (startDate) conditions.push(gte(transaction.date, new Date(startDate)));
    if (endDate) conditions.push(lte(transaction.date, new Date(endDate)));
    if (categoryIds) conditions.push(inArray(transaction.categoryId, categoryIds));
    if (accountIds) conditions.push(inArray(transaction.accountId, accountIds));
    if (cardIds) conditions.push(inArray(transaction.cardId, cardIds));
    if (transactionTypes) conditions.push(inArray(transaction.type, transactionTypes));

    const transactionsData = await app.db.select({
      ...transaction,
      card: creditCard,
    })
      .from(transaction)
      .leftJoin(creditCard, eq(transaction.cardId, creditCard.id))
      .where(and(...conditions));

    const cardMap = new Map<string, { total: number; count: number; name: string }>();

    for (const t of transactionsData) {
      const cardId = t.transaction.cardId!;
      const name = t.card?.name || 'Cartão desconhecido';
      const existing = cardMap.get(cardId) || { total: 0, count: 0, name };
      existing.total += Number(t.transaction.amountCents);
      existing.count += 1;
      cardMap.set(cardId, existing);
    }

    return Array.from(cardMap.entries()).map(([cardId, data]) => ({
      cardId,
      cardName: data.name,
      total: { cents: data.total, currency: 'BRL' as const },
      transactionCount: data.count,
    })).sort((a, b) => b.total.cents - a.total.cents);
  });

  app.get('/fixed-vs-variable', {
    schema: { querystring: reportFiltersSchema.shape.query },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { startDate, endDate } = request.query;
    const userId = request.authUser!.id;

    const conditions = [
      eq(transaction.userId, userId),
      eq(transaction.type, 'EXPENSE'),
    ];
    if (startDate) conditions.push(gte(transaction.date, new Date(startDate)));
    if (endDate) conditions.push(lte(transaction.date, new Date(endDate)));

    const [transactionsData, installmentsData, recurringBillsData] = await Promise.all([
      app.db.select().from(transaction).where(and(...conditions)),
      app.db.select({
        ...installment,
        plan: installmentPlan,
      })
        .from(installment)
        .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
        .where(and(eq(installmentPlan.userId, userId), inArray(installment.status, ['PENDING', 'PAID']))),
      app.db.select().from(recurringBill)
        .where(and(eq(recurringBill.userId, userId), eq(recurringBill.status, 'ACTIVE'))),
    ]);

    let variable = 0;
    let fixed = 0;
    let installmentTotal = 0;
    let recurringTotal = 0;

    for (const t of transactionsData) {
      if (!t.installmentPlanId && !t.recurringBillId) {
        variable += Number(t.amountCents);
      }
    }

    for (const i of installmentsData) {
      installmentTotal += Number(i.installment.amountCents);
    }

    for (const r of recurringBillsData) {
      recurringTotal += Number(r.amountCents);
    }

    fixed = installmentTotal + recurringTotal;

    return {
      fixed: { cents: fixed, currency: 'BRL' as const },
      variable: { cents: variable, currency: 'BRL' as const },
      installments: { cents: installmentTotal, currency: 'BRL' as const },
      recurring: { cents: recurringTotal, currency: 'BRL' as const },
    };
  });

  app.get('/installments', {
    schema: { querystring: reportFiltersSchema.shape.query.merge(z.object({ months: z.coerce.number().int().positive().max(24).default(12) })) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { startDate, endDate, months } = request.query;
    const userId = request.authUser!.id;
    const now = new Date();
    const end = endDate ? new Date(endDate) : addMonths(now, months);

    const cardIds = await app.db.select({ id: creditCard.id })
      .from(creditCard)
      .where(eq(creditCard.userId, userId));
    const cardIdArray = cardIds.map(c => c.id);

    const planIds = await app.db.select({ id: installmentPlan.id })
      .from(installmentPlan)
      .where(inArray(installmentPlan.cardId, cardIdArray));
    const planIdArray = planIds.map(p => p.id);

    const installmentsData = await app.db.select({
      ...installment,
      plan: {
        ...installmentPlan,
        card: creditCard,
      },
      invoice: invoice,
    })
      .from(installment)
      .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
      .leftJoin(creditCard, eq(installmentPlan.cardId, creditCard.id))
      .leftJoin(invoice, eq(installment.invoiceId, invoice.id))
      .where(and(
        inArray(installment.planId, planIdArray),
        inArray(installment.status, ['PENDING', 'OVERDUE']),
        gte(installment.dueDate, now),
        lte(installment.dueDate, end)
      ))
      .orderBy(asc(installment.dueDate));

    const byMonth = new Map<string, { total: number; count: number }>();

    for (const i of installmentsData) {
      const key = getMonthKey(new Date(i.installment.dueDate));
      const existing = byMonth.get(key) || { total: 0, count: 0 };
      existing.total += Number(i.installment.amountCents);
      existing.count += 1;
      byMonth.set(key, existing);
    }

    return Array.from(byMonth.entries())
      .map(([month, data]) => ({
        month,
        total: { cents: data.total, currency: 'BRL' as const },
        count: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  });

  app.get('/debts', {
    schema: { querystring: reportFiltersSchema.shape.query },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;

    const [toPayData, toReceiveData] = await Promise.all([
      app.db.select({
        ...debt,
        relatedPerson: person,
      })
        .from(debt)
        .leftJoin(person, eq(debt.relatedPersonId, person.id))
        .where(and(eq(debt.userId, userId), inArray(debt.status, ['ACTIVE', 'OVERDUE'])))
        .orderBy(asc(debt.dueDate)),
      app.db.select({
        ...debt,
        relatedPerson: person,
      })
        .from(debt)
        .innerJoin(person, eq(debt.relatedPersonId, person.id))
        .where(and(eq(person.userId, userId), inArray(debt.status, ['ACTIVE', 'OVERDUE'])))
        .orderBy(asc(debt.dueDate)),
    ]);

    return {
      toPay: toPayData.map((d) => ({
        id: d.debt.id,
        description: d.debt.description,
        total: { cents: Number(d.debt.totalAmountCents), currency: 'BRL' as const },
        remaining: { cents: Number(d.debt.remainingAmountCents), currency: 'BRL' as const },
        dueDate: d.debt.dueDate.toISOString(),
        relatedPerson: d.relatedPerson?.name,
      })),
      toReceive: toReceiveData.map((d) => ({
        id: d.debt.id,
        description: d.debt.description,
        total: { cents: Number(d.debt.totalAmountCents), currency: 'BRL' as const },
        remaining: { cents: Number(d.debt.remainingAmountCents), currency: 'BRL' as const },
        dueDate: d.debt.dueDate.toISOString(),
        relatedPerson: d.relatedPerson?.name,
      })),
    };
  });

  app.get('/invoices', {
    schema: { querystring: reportFiltersSchema.shape.query.merge(z.object({ months: z.coerce.number().int().positive().max(24).default(12) })) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { months } = request.query;
    const userId = request.authUser!.id;
    const now = new Date();
    const end = addMonths(now, months);

    const cards = await app.db.select().from(creditCard).where(eq(creditCard.userId, userId));

    const result = [];
    for (const card of cards) {
      const invoicesData = await app.db.select()
        .from(invoice)
        .where(and(eq(invoice.cardId, card.id), lte(invoice.periodStart, end)))
        .orderBy(asc(invoice.periodStart));

      result.push({
        cardId: card.id,
        cardName: card.name,
        invoices: invoicesData.map((i) => ({
          id: i.id,
          period: `${i.periodStart.toISOString().slice(0, 7)}`,
          total: { cents: Number(i.totalCents), currency: 'BRL' as const },
          paid: { cents: Number(i.paidCents), currency: 'BRL' as const },
          status: i.status,
          dueDate: i.dueDate.toISOString(),
        })),
      });
    }

    return result;
  });

  app.get('/cashflow', {
    schema: { querystring: reportFiltersSchema.shape.query.merge(z.object({ months: z.coerce.number().int().positive().max(24).default(12) })) },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { months } = request.query;
    const userId = request.authUser!.id;
    const now = new Date();
    const end = addMonths(now, months);

    const monthsList: string[] = [];
    for (let i = 0; i < months; i++) {
      const d = addMonths(now, i);
      monthsList.push(getMonthKey(d));
    }

    const [billsData, installmentsData, invoicesData] = await Promise.all([
      app.db.select().from(bill)
        .where(and(eq(bill.userId, userId), inArray(bill.status, ['PENDING', 'OVERDUE']), lte(bill.dueDate, end))),
      app.db.select({
        ...installment,
        plan: installmentPlan,
      })
        .from(installment)
        .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
        .where(and(eq(installmentPlan.userId, userId), inArray(installment.status, ['PENDING', 'OVERDUE']), lte(installment.dueDate, end))),
      app.db.select({
        ...invoice,
        card: creditCard,
      })
        .from(invoice)
        .leftJoin(creditCard, eq(invoice.cardId, creditCard.id))
        .where(and(eq(creditCard.userId, userId), inArray(invoice.status, ['OPEN', 'CLOSED', 'PARTIALLY_PAID', 'OVERDUE']), lte(invoice.dueDate, end))),
    ]);

    const monthData = new Map<string, { bills: number; installments: number; cards: number }>();

    for (const m of monthsList) {
      monthData.set(m, { bills: 0, installments: 0, cards: 0 });
    }

    for (const b of billsData) {
      const key = getMonthKey(new Date(b.dueDate));
      const data = monthData.get(key);
      if (data) data.bills += Number(b.amountCents);
    }

    for (const i of installmentsData) {
      const key = getMonthKey(new Date(i.installment.dueDate));
      const data = monthData.get(key);
      if (data) data.installments += Number(i.installment.amountCents);
    }

    for (const inv of invoicesData) {
      const key = getMonthKey(new Date(inv.invoice.dueDate));
      const data = monthData.get(key);
      if (data) data.cards += Number(inv.invoice.remainingCents);
    }

    const monthsResult = Array.from(monthData.entries()).map(([month, data]) => ({
      month,
      bills: { cents: data.bills, currency: 'BRL' as const },
      installments: { cents: data.installments, currency: 'BRL' as const },
      cards: { cents: data.cards, currency: 'BRL' as const },
      totalCommitted: { cents: data.bills + data.installments + data.cards, currency: 'BRL' as const },
    }));

    const totalProjected = monthsResult.reduce((sum, m) => sum + m.totalCommitted.cents, 0);

    return {
      months: monthsResult,
      totalProjected: { cents: totalProjected, currency: 'BRL' as const },
    };
  });

  app.get('/summary', {
    schema: { querystring: reportFiltersSchema.shape.query },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.authUser!.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      accountsData,
      cardsData,
      expensesAgg,
      incomeAgg,
      pendingBillsAgg,
      debtsAgg,
      owedDebtsAgg,
      currentInvoicesData,
      upcomingInvoicesData,
      upcomingBillsData,
      upcomingInstallmentsData,
    ] = await Promise.all([
      app.db.select().from(bankAccount).where(and(eq(bankAccount.userId, userId), eq(bankAccount.status, 'ACTIVE'))),
      app.db.select().from(creditCard).where(and(eq(creditCard.userId, userId), eq(creditCard.status, 'ACTIVE'))),
      app.db.select({ sum: sum(transaction.amountCents) })
        .from(transaction)
        .where(and(eq(transaction.userId, userId), eq(transaction.type, 'EXPENSE'), gte(transaction.date, startOfMonth), lte(transaction.date, endOfMonth))),
      app.db.select({ sum: sum(transaction.amountCents) })
        .from(transaction)
        .where(and(eq(transaction.userId, userId), eq(transaction.type, 'INCOME'), gte(transaction.date, startOfMonth), lte(transaction.date, endOfMonth))),
      app.db.select({ sum: sum(bill.amountCents) })
        .from(bill)
        .where(and(eq(bill.userId, userId), inArray(bill.status, ['PENDING', 'OVERDUE']))),
      app.db.select({ sum: sum(debt.remainingAmountCents) })
        .from(debt)
        .where(and(eq(debt.userId, userId), inArray(debt.status, ['ACTIVE', 'OVERDUE']))),
      app.db.select({ sum: sum(debt.remainingAmountCents) })
        .from(debt)
        .innerJoin(person, eq(debt.relatedPersonId, person.id))
        .where(and(eq(person.userId, userId), inArray(debt.status, ['ACTIVE', 'OVERDUE']))),
      app.db.select({
        ...invoice,
        card: creditCard,
      })
        .from(invoice)
        .leftJoin(creditCard, eq(invoice.cardId, creditCard.id))
        .where(and(eq(creditCard.userId, userId), lte(invoice.periodStart, now), gte(invoice.periodEnd, now))),
      app.db.select({
        ...invoice,
        card: creditCard,
      })
        .from(invoice)
        .leftJoin(creditCard, eq(invoice.cardId, creditCard.id))
        .where(and(eq(creditCard.userId, userId), gt(invoice.periodStart, now)))
        .orderBy(asc(invoice.periodStart))
        .limit(5),
      app.db.select().from(bill)
        .where(and(eq(bill.userId, userId), inArray(bill.status, ['PENDING', 'OVERDUE']), gte(bill.dueDate, now)))
        .orderBy(asc(bill.dueDate))
        .limit(10),
      app.db.select({
        ...installment,
        plan: installmentPlan,
      })
        .from(installment)
        .leftJoin(installmentPlan, eq(installment.planId, installmentPlan.id))
        .where(and(eq(installmentPlan.userId, userId), inArray(installment.status, ['PENDING', 'OVERDUE']), gte(installment.dueDate, now)))
        .orderBy(asc(installment.dueDate))
        .limit(10),
    ]);

    const totalBalance = accountsData.reduce((sum, a) => sum + Number(a.balanceCents), 0);

    const [fixedExpensesAgg] = await app.db.select({ sum: sum(recurringBill.amountCents) })
      .from(recurringBill)
      .where(and(eq(recurringBill.userId, userId), eq(recurringBill.status, 'ACTIVE')));

    return {
      totalBalance: { cents: totalBalance, currency: 'BRL' as const },
      accountsBalance: accountsData.map((a) => ({
        accountId: a.id,
        name: a.name,
        balance: { cents: Number(a.balanceCents), currency: 'BRL' as const },
      })),
      totalExpensesMonth: { cents: Number(expensesAgg[0]?.sum || 0), currency: 'BRL' as const },
      totalIncomeMonth: { cents: Number(incomeAgg[0]?.sum || 0), currency: 'BRL' as const },
      pendingBillsTotal: { cents: Number(pendingBillsAgg[0]?.sum || 0), currency: 'BRL' as const },
      debtsTotal: { cents: Number(debtsAgg[0]?.sum || 0), currency: 'BRL' as const },
      owedTotal: { cents: Number(owedDebtsAgg[0]?.sum || 0), currency: 'BRL' as const },
      currentInvoices: currentInvoicesData.map((i) => ({
        cardId: i.invoice.cardId,
        name: i.card?.name || '',
        total: { cents: Number(i.invoice.totalCents), currency: 'BRL' as const },
        dueDate: i.invoice.dueDate.toISOString(),
      })),
      upcomingInvoices: upcomingInvoicesData.map((i) => ({
        cardId: i.invoice.cardId,
        name: i.card?.name || '',
        estimatedTotal: { cents: Number(i.invoice.totalCents), currency: 'BRL' as const },
        dueDate: i.invoice.dueDate.toISOString(),
      })),
      upcomingBills: upcomingBillsData.map((b) => ({
        id: b.id,
        description: b.description,
        amount: { cents: Number(b.amountCents), currency: 'BRL' as const },
        dueDate: b.dueDate.toISOString(),
      })),
      upcomingInstallments: upcomingInstallmentsData.map((i) => ({
        planId: i.installment.planId,
        description: i.plan?.description || '',
        amount: { cents: Number(i.installment.amountCents), currency: 'BRL' as const },
        dueDate: i.installment.dueDate.toISOString(),
      })),
      fixedExpenses: { cents: Number(fixedExpensesAgg[0]?.sum || 0), currency: 'BRL' as const },
      cashflowProjection: [],
    };
  });
};

export default reportsRoutes;