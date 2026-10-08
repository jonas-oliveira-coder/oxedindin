import { describe, it, expect } from 'vitest';
import {
  getInvoiceCycle,
  getInvoiceCycleForDate,
  getInvoiceCycleFromDueDate,
  resolveInvoiceStatus,
} from './invoice.service.js';

describe('invoice.service', () => {
  describe('getInvoiceCycleForDate', () => {
    it('assigns purchase before closing day to current month cycle', () => {
      // Oct 5, closing 10, due 17
      const cycle = getInvoiceCycleForDate(new Date('2026-10-05T12:00:00Z'), 10, 17);
      expect(cycle.cycleYear).toBe(2026);
      expect(cycle.cycleMonth).toBe(9); // Oct (0-indexed)
      expect(cycle.closingDate.toISOString().slice(0, 10)).toBe('2026-10-10');
      expect(cycle.dueDate.toISOString().slice(0, 10)).toBe('2026-10-17');
    });

    it('assigns purchase on closing day to current month cycle', () => {
      // Oct 10, closing 10, due 17
      const cycle = getInvoiceCycleForDate(new Date('2026-10-10T12:00:00Z'), 10, 17);
      expect(cycle.cycleYear).toBe(2026);
      expect(cycle.cycleMonth).toBe(9); // Oct
      expect(cycle.closingDate.toISOString().slice(0, 10)).toBe('2026-10-10');
      expect(cycle.dueDate.toISOString().slice(0, 10)).toBe('2026-10-17');
    });

    it('assigns purchase after closing day to next month cycle (melhor dia de compra)', () => {
      // Oct 11, closing 10, due 17 -> Nov cycle
      const cycle = getInvoiceCycleForDate(new Date('2026-10-11T12:00:00Z'), 10, 17);
      expect(cycle.cycleYear).toBe(2026);
      expect(cycle.cycleMonth).toBe(10); // Nov (0-indexed)
      expect(cycle.closingDate.toISOString().slice(0, 10)).toBe('2026-11-10');
      expect(cycle.dueDate.toISOString().slice(0, 10)).toBe('2026-11-17');
    });

    it('handles dueDay <= closingDay by setting dueDate in the following month', () => {
      // Closing 25, due 5. Purchase Oct 20 -> Oct closing, Nov 5 due
      const cycle = getInvoiceCycleForDate(new Date('2026-10-20T12:00:00Z'), 25, 5);
      expect(cycle.cycleYear).toBe(2026);
      expect(cycle.cycleMonth).toBe(9); // Oct
      expect(cycle.closingDate.toISOString().slice(0, 10)).toBe('2026-10-25');
      expect(cycle.dueDate.toISOString().slice(0, 10)).toBe('2026-11-05');
    });
  });

  describe('installment progression with getInvoiceCycle', () => {
    it('generates sequential cycles for installments starting in the purchase cycle', () => {
      // Purchase Oct 5, 3 installments, closing 10, due 17
      const firstCycle = getInvoiceCycleForDate(new Date('2026-10-05T12:00:00Z'), 10, 17);

      const cycles = [];
      for (let i = 0; i < 3; i++) {
        cycles.push(getInvoiceCycle(firstCycle.cycleYear, firstCycle.cycleMonth + i, 10, 17));
      }

      // Parcela 1: Outubro
      expect(cycles[0].closingDate.toISOString().slice(0, 10)).toBe('2026-10-10');
      expect(cycles[0].dueDate.toISOString().slice(0, 10)).toBe('2026-10-17');

      // Parcela 2: Novembro
      expect(cycles[1].closingDate.toISOString().slice(0, 10)).toBe('2026-11-10');
      expect(cycles[1].dueDate.toISOString().slice(0, 10)).toBe('2026-11-17');

      // Parcela 3: Dezembro
      expect(cycles[2].closingDate.toISOString().slice(0, 10)).toBe('2026-12-10');
      expect(cycles[2].dueDate.toISOString().slice(0, 10)).toBe('2026-12-17');
    });
  });

  describe('resolveInvoiceStatus', () => {
    const closingDate = new Date('2026-10-10T23:59:59Z');
    const dueDate = new Date('2026-10-17T12:00:00Z');

    it('returns OPEN when before closing date', () => {
      const now = new Date('2026-10-05T12:00:00Z');
      const status = resolveInvoiceStatus(
        { totalCents: 5000, paidCents: 0, remainingCents: 5000, closingDate, dueDate },
        now
      );
      expect(status).toBe('OPEN');
    });

    it('returns CLOSED when past closing date but before due date and unpaid', () => {
      const now = new Date('2026-10-12T12:00:00Z');
      const status = resolveInvoiceStatus(
        { totalCents: 5000, paidCents: 0, remainingCents: 5000, closingDate, dueDate },
        now
      );
      expect(status).toBe('CLOSED');
    });

    it('returns OVERDUE when past due date and remaining > 0', () => {
      const now = new Date('2026-10-20T12:00:00Z');
      const status = resolveInvoiceStatus(
        { totalCents: 5000, paidCents: 0, remainingCents: 5000, closingDate, dueDate },
        now
      );
      expect(status).toBe('OVERDUE');
    });

    it('returns PAID when fully paid', () => {
      const now = new Date('2026-10-15T12:00:00Z');
      const status = resolveInvoiceStatus(
        { totalCents: 5000, paidCents: 5000, remainingCents: 0, closingDate, dueDate },
        now
      );
      expect(status).toBe('PAID');
    });

    it('returns PARTIALLY_PAID when partially paid', () => {
      const now = new Date('2026-10-15T12:00:00Z');
      const status = resolveInvoiceStatus(
        { totalCents: 5000, paidCents: 2000, remainingCents: 3000, closingDate, dueDate },
        now
      );
      expect(status).toBe('PARTIALLY_PAID');
    });
  });
});
