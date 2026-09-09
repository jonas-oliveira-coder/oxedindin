import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { reportFiltersSchema } from '../../types/schemas.js';

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

    const where: any = { userId, type: 'EXPENSE' };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (categoryIds) where.categoryId = { in: categoryIds };
    if (accountIds) where.accountId = { in: accountIds };
    if (cardIds) where.cardId = { in: cardIds };
    if (transactionTypes) where.type = { in: transactionTypes };

    const transactions = await app.prisma.transaction.findMany({
      where,
      include: { category: true },
    });

    const categoryMap = new Map<string, { total: number; count: number; category: any }>();
    let grandTotal = 0;

    for (const t of transactions) {
      const catId = t.categoryId || 'uncategorized';
      const cat = t.category || { name: 'Sem categoria', color: '#6B7280' };
      const existing = categoryMap.get(catId) || { total: 0, count: 0, category: cat };
      existing.total += Number(t.amountCents);
      existing.count += 1;
      categoryMap.set(catId, existing);
      grandTotal += Number(t.amountCents);
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

    const where: any = { userId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await app.prisma.transaction.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const periodMap = new Map<string, { expenses: number; income: number }>();

    for (const t of transactions) {
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

    const where: any = { userId, type: 'EXPENSE' };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (categoryIds) where.categoryId = { in: categoryIds };
    if (accountIds) where.accountId = { in: accountIds };
    if (cardIds) where.cardId = { in: cardIds };
    if (transactionTypes) where.type = { in: transactionTypes };

    const transactions = await app.prisma.transaction.findMany({
      where,
      include: { account: true },
    });

    const accountMap = new Map<string, { total: number; count: number; name: string }>();

    for (const t of transactions) {
      const accId = t.accountId || 'no-account';
      const name = t.account?.name || 'Sem conta';
      const existing = accountMap.get(accId) || { total: 0, count: 0, name };
      existing.total += Number(t.amountCents);
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

    const where: any = { userId, type: 'EXPENSE', cardId: { not: null } };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (categoryIds) where.categoryId = { in: categoryIds };
    if (accountIds) where.accountId = { in: accountIds };
    if (cardIds) where.cardId = { in: cardIds };
    if (transactionTypes) where.type = { in: transactionTypes };

    const transactions = await app.prisma.transaction.findMany({
      where,
      include: { card: true },
    });

    const cardMap = new Map<string, { total: number; count: number; name: string }>();

    for (const t of transactions) {
      const cardId = t.cardId!;
      const name = t.card?.name || 'Cartão desconhecido';
      const existing = cardMap.get(cardId) || { total: 0, count: 0, name };
      existing.total += Number(t.amountCents);
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

    const where: any = { userId, type: 'EXPENSE' };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [transactions, installments, recurringBills] = await Promise.all([
      app.prisma.transaction.findMany({ where }),
      app.prisma.installment.findMany({
        where: { plan: { userId }, status: { in: ['PENDING', 'PAID'] } },
        include: { plan: true },
      }),
      app.prisma.recurringBill.findMany({ where: { userId, status: 'ACTIVE' } }),
    ]);

    let variable = 0;
    let fixed = 0;
    let installmentTotal = 0;
    let recurringTotal = 0;

    for (const t of transactions) {
      if (!t.installmentPlanId && !t.recurringBillId) {
        variable += Number(t.amountCents);
      }
    }

    for (const i of installments) {
      installmentTotal += Number(i.amountCents);
    }

    for (const r of recurringBills) {
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

    const installments = await app.prisma.installment.findMany({
      where: {
        plan: { userId },
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { gte: now, lte: end },
      },
      include: { plan: { include: { card: true } }, invoice: true },
      orderBy: { dueDate: 'asc' },
    });

    const byMonth = new Map<string, { total: number; count: number }>();

    for (const i of installments) {
      const key = getMonthKey(new Date(i.dueDate));
      const existing = byMonth.get(key) || { total: 0, count: 0 };
      existing.total += Number(i.amountCents);
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

    const [toPay, toReceive] = await Promise.all([
      app.prisma.debt.findMany({
        where: { userId, status: { in: ['ACTIVE', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
        include: { relatedPerson: true },
      }),
      app.prisma.debt.findMany({
        where: { relatedPerson: { userId }, status: { in: ['ACTIVE', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
        include: { relatedPerson: true, sharedDebts: true },
      }),
    ]);

    return {
      toPay: toPay.map((d) => ({
        id: d.id,
        description: d.description,
        total: { cents: Number(d.totalAmountCents), currency: 'BRL' as const },
        remaining: { cents: Number(d.remainingAmountCents), currency: 'BRL' as const },
        dueDate: d.dueDate.toISOString(),
        relatedPerson: d.relatedPerson?.name,
      })),
      toReceive: toReceive.map((d) => ({
        id: d.id,
        description: d.description,
        total: { cents: Number(d.totalAmountCents), currency: 'BRL' as const },
        remaining: { cents: Number(d.remainingAmountCents), currency: 'BRL' as const },
        dueDate: d.dueDate.toISOString(),
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

    const cards = await app.prisma.creditCard.findMany({ where: { userId } });

    const result = [];
    for (const card of cards) {
      const invoices = await app.prisma.invoice.findMany({
        where: { cardId: card.id, periodStart: { lte: end } },
        orderBy: { periodStart: 'asc' },
      });

      result.push({
        cardId: card.id,
        cardName: card.name,
        invoices: invoices.map((i) => ({
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

    const [bills, installments, invoices] = await Promise.all([
      app.prisma.bill.findMany({
        where: { userId, status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lte: end } },
      }),
      app.prisma.installment.findMany({
        where: { plan: { userId }, status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { lte: end } },
      }),
      app.prisma.invoice.findMany({
        where: { card: { userId }, status: { in: ['OPEN', 'CLOSED', 'PARTIALLY_PAID', 'OVERDUE'] }, dueDate: { lte: end } },
      }),
    ]);

    const monthData = new Map<string, { bills: number; installments: number; cards: number }>();

    for (const m of monthsList) {
      monthData.set(m, { bills: 0, installments: 0, cards: 0 });
    }

    for (const b of bills) {
      const key = getMonthKey(new Date(b.dueDate));
      const data = monthData.get(key);
      if (data) data.bills += Number(b.amountCents);
    }

    for (const i of installments) {
      const key = getMonthKey(new Date(i.dueDate));
      const data = monthData.get(key);
      if (data) data.installments += Number(i.amountCents);
    }

    for (const inv of invoices) {
      const key = getMonthKey(new Date(inv.dueDate));
      const data = monthData.get(key);
      if (data) data.cards += Number(inv.remainingCents);
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
      accounts,
      cards,
      expensesAgg,
      incomeAgg,
      pendingBills,
      debts,
      owedDebts,
      currentInvoices,
      upcomingInvoices,
      upcomingBills,
      upcomingInstallments,
    ] = await Promise.all([
      app.prisma.bankAccount.findMany({ where: { userId, status: 'ACTIVE' } }),
      app.prisma.creditCard.findMany({ where: { userId, status: 'ACTIVE' } }),
      app.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amountCents: true },
      }),
      app.prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amountCents: true },
      }),
      app.prisma.bill.aggregate({
        where: { userId, status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amountCents: true },
      }),
      app.prisma.debt.aggregate({
        where: { userId, status: { in: ['ACTIVE', 'OVERDUE'] } },
        _sum: { remainingAmountCents: true },
      }),
      app.prisma.debt.aggregate({
        where: { relatedPerson: { userId }, status: { in: ['ACTIVE', 'OVERDUE'] } },
        _sum: { remainingAmountCents: true },
      }),
      app.prisma.invoice.findMany({
        where: {
          card: { userId },
          periodStart: { lte: now },
          periodEnd: { gte: now },
        },
        include: { card: true },
      }),
      app.prisma.invoice.findMany({
        where: {
          card: { userId },
          periodStart: { gt: now },
        },
        orderBy: { periodStart: 'asc' },
        take: 5,
        include: { card: true },
      }),
      app.prisma.bill.findMany({
        where: { userId, status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { gte: now } },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      app.prisma.installment.findMany({
        where: { plan: { userId }, status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { gte: now } },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: { plan: true },
      }),
    ]);

    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balanceCents), 0);

    const fixedExpenses = await app.prisma.recurringBill.aggregate({
      where: { userId, status: 'ACTIVE' },
      _sum: { amountCents: true },
    });

    return {
      totalBalance: { cents: totalBalance, currency: 'BRL' as const },
      accountsBalance: accounts.map((a) => ({
        accountId: a.id,
        name: a.name,
        balance: { cents: Number(a.balanceCents), currency: 'BRL' as const },
      })),
      totalExpensesMonth: { cents: Number(expensesAgg._sum.amountCents || 0), currency: 'BRL' as const },
      totalIncomeMonth: { cents: Number(incomeAgg._sum.amountCents || 0), currency: 'BRL' as const },
      pendingBillsTotal: { cents: Number(pendingBills._sum.amountCents || 0), currency: 'BRL' as const },
      debtsTotal: { cents: Number(debts._sum.remainingAmountCents || 0), currency: 'BRL' as const },
      owedTotal: { cents: Number(owedDebts._sum.remainingAmountCents || 0), currency: 'BRL' as const },
      currentInvoices: currentInvoices.map((i) => ({
        cardId: i.cardId,
        name: i.card.name,
        total: { cents: Number(i.totalCents), currency: 'BRL' as const },
        dueDate: i.dueDate.toISOString(),
      })),
      upcomingInvoices: upcomingInvoices.map((i) => ({
        cardId: i.cardId,
        name: i.card.name,
        estimatedTotal: { cents: Number(i.totalCents), currency: 'BRL' as const },
        dueDate: i.dueDate.toISOString(),
      })),
      upcomingBills: upcomingBills.map((b) => ({
        id: b.id,
        description: b.description,
        amount: { cents: Number(b.amountCents), currency: 'BRL' as const },
        dueDate: b.dueDate.toISOString(),
      })),
      upcomingInstallments: upcomingInstallments.map((i) => ({
        planId: i.planId,
        description: i.plan.description,
        amount: { cents: Number(i.amountCents), currency: 'BRL' as const },
        dueDate: i.dueDate.toISOString(),
      })),
      fixedExpenses: { cents: Number(fixedExpenses._sum.amountCents || 0), currency: 'BRL' as const },
      cashflowProjection: [],
    };
  });
};

export default reportsRoutes;