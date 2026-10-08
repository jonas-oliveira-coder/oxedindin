import { eq, and, sql, sum, inArray, desc, gte, lte } from 'drizzle-orm';
import { invoice, transaction, installment, creditCard } from '../db/schema/index.js';

export interface InvoiceCycle {
  cycleYear: number;
  cycleMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  periodStart: Date;
  periodEnd: Date;
  closingDate: Date;
  dueDate: Date;
}

/**
 * Returns the invoice cycle for a given cycle year and cycle month (0-indexed).
 */
export function getInvoiceCycle(
  cycleYear: number,
  cycleMonth: number,
  closingDay: number,
  dueDay: number
): InvoiceCycle {
  // Normalize year and month in case cycleMonth is out of [0, 11]
  const normalizedDate = new Date(Date.UTC(cycleYear, cycleMonth, 1));
  const year = normalizedDate.getUTCFullYear();
  const month = normalizedDate.getUTCMonth();

  // Closing date of this cycle:
  const lastDayOfCycleMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const actualClosingDay = Math.min(closingDay, lastDayOfCycleMonth);
  const closingDate = new Date(Date.UTC(year, month, actualClosingDay, 23, 59, 59, 999));
  const periodEnd = new Date(closingDate);

  // Previous cycle closing date:
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear--;
  }
  const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
  const actualPrevClosingDay = Math.min(closingDay, lastDayOfPrevMonth);
  const periodStart = new Date(Date.UTC(prevYear, prevMonth, actualPrevClosingDay + 1, 0, 0, 0, 0));

  // Due date:
  let dueYear = year;
  let dueMonth = month;
  if (dueDay <= closingDay) {
    dueMonth++;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear++;
    }
  }
  const lastDayOfDueMonth = new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate();
  const actualDueDay = Math.min(dueDay, lastDayOfDueMonth);
  const dueDate = new Date(Date.UTC(dueYear, dueMonth, actualDueDay, 12, 0, 0, 0));

  return {
    cycleYear: year,
    cycleMonth: month,
    periodStart,
    periodEnd,
    closingDate,
    dueDate,
  };
}

/**
 * Determines which invoice cycle a given purchase/transaction date belongs to.
 * 
 * In standard credit card billing:
 * - A purchase on or before the closing day belongs to that month's invoice.
 * - A purchase after the closing day belongs to the next month's invoice.
 */
export function getInvoiceCycleForDate(
  date: Date,
  closingDay: number,
  dueDay: number
): InvoiceCycle {
  // Use UTC values or local day depending on how date was constructed
  const d = new Date(date);
  // Read day, month, year. If it was passed as ISO UTC at midnight (e.g. 2026-10-08T00:00:00Z),
  // read UTC components to avoid timezone shifts.
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  let cycleYear = year;
  let cycleMonth = month;

  if (day > closingDay) {
    cycleMonth++;
    if (cycleMonth > 11) {
      cycleMonth = 0;
      cycleYear++;
    }
  }

  return getInvoiceCycle(cycleYear, cycleMonth, closingDay, dueDay);
}

/**
 * Resolves the cycle from an explicit due date (e.g. for installments where firstInvoiceDate is the due date).
 */
export function getInvoiceCycleFromDueDate(
  dueDate: Date,
  closingDay: number,
  dueDay: number
): InvoiceCycle {
  const d = new Date(dueDate);
  const dueYear = d.getUTCFullYear();
  const dueMonth = d.getUTCMonth();

  let cycleYear = dueYear;
  let cycleMonth = dueMonth;
  if (dueDay <= closingDay) {
    cycleMonth--;
    if (cycleMonth < 0) {
      cycleMonth = 11;
      cycleYear--;
    }
  }

  return getInvoiceCycle(cycleYear, cycleMonth, closingDay, dueDay);
}

/**
 * Finds or inserts an invoice for the specified card and cycle.
 */
export async function getOrCreateInvoiceForCycle(
  dbOrTx: any,
  card: { id: string; closingDay: number; dueDay: number },
  cycle: InvoiceCycle
): Promise<any> {
  // Look for invoice matching card and closing date range
  const minClosing = new Date(cycle.closingDate);
  minClosing.setDate(minClosing.getDate() - 3);
  const maxClosing = new Date(cycle.closingDate);
  maxClosing.setDate(maxClosing.getDate() + 3);

  const [existing] = await dbOrTx.select()
    .from(invoice)
    .where(and(
      eq(invoice.cardId, card.id),
      gte(invoice.closingDate, minClosing),
      lte(invoice.closingDate, maxClosing)
    ))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await dbOrTx.insert(invoice).values({
    cardId: card.id,
    periodStart: cycle.periodStart,
    periodEnd: cycle.periodEnd,
    closingDate: cycle.closingDate,
    dueDate: cycle.dueDate,
    totalCents: 0n,
    paidCents: 0n,
    remainingCents: 0n,
    status: 'OPEN',
  }).returning();

  return created;
}

/**
 * Resolves the accurate business status of an invoice.
 */
export function resolveInvoiceStatus(
  inv: { totalCents: number | bigint; paidCents: number | bigint; remainingCents: number | bigint; closingDate: Date | string; dueDate: Date | string; status?: string },
  now = new Date()
): 'OPEN' | 'CLOSED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' {
  const total = Number(inv.totalCents || 0);
  const paid = Number(inv.paidCents || 0);
  const remaining = Number(inv.remainingCents || 0);
  const dueDate = new Date(inv.dueDate);
  const closingDate = new Date(inv.closingDate);

  if (total > 0 && remaining === 0) {
    return 'PAID';
  }
  if (paid > 0 && remaining > 0) {
    return 'PARTIALLY_PAID';
  }
  if (dueDate < now && remaining > 0) {
    return 'OVERDUE';
  }
  if (closingDate < now && remaining > 0) {
    return 'CLOSED';
  }
  return 'OPEN';
}

/**
 * Recalculates totalCents, remainingCents and status of an invoice
 * based on all its linked transactions and installments.
 */
export async function recalculateInvoice(dbOrTx: any, invoiceId: string): Promise<any> {
  const [inv] = await dbOrTx.select().from(invoice).where(eq(invoice.id, invoiceId)).limit(1);
  if (!inv) return null;

  const [txSum] = await dbOrTx.select({ sum: sum(transaction.amountCents) })
    .from(transaction)
    .where(and(eq(transaction.invoiceId, invoiceId), eq(transaction.type, 'EXPENSE')));

  // Find plan IDs that already have transactions recorded on this invoice
  const txRows = await dbOrTx.select({ installmentPlanId: transaction.installmentPlanId })
    .from(transaction)
    .where(and(eq(transaction.invoiceId, invoiceId), eq(transaction.type, 'EXPENSE')));
  const plansWithTransactions = new Set(txRows.map((t: any) => t.installmentPlanId).filter(Boolean));

  // Only sum legacy/orphan installments that don't already have a corresponding transaction
  const instRows = await dbOrTx.select({ amountCents: installment.amountCents, planId: installment.planId })
    .from(installment)
    .where(eq(installment.invoiceId, invoiceId));

  let orphanInstSum = 0;
  for (const inst of instRows) {
    if (!plansWithTransactions.has(inst.planId)) {
      orphanInstSum += Number(inst.amountCents || 0);
    }
  }

  const total = Number(txSum?.sum || 0) + orphanInstSum;
  const paid = Number(inv.paidCents || 0);
  const remaining = Math.max(0, total - paid);

  const status = resolveInvoiceStatus({
    totalCents: total,
    paidCents: paid,
    remainingCents: remaining,
    closingDate: inv.closingDate,
    dueDate: inv.dueDate,
  });

  const [updated] = await dbOrTx.update(invoice)
    .set({
      totalCents: BigInt(total),
      remainingCents: BigInt(remaining),
      status,
      updatedAt: new Date(),
    })
    .where(eq(invoice.id, invoiceId))
    .returning();

  return updated;
}
