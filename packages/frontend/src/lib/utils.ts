import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseMoneyToCents } from '@oxedindin/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number, currency = 'BRL', locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function parseMoney(value: string): number {
  const cents = parseMoneyToCents(value);
  return cents == null ? 0 : cents;
}

/**
 * Formats a calendar date. Calendar dates are stored in the API as UTC-midnight
 * timestamps (or "YYYY-MM-DD" strings) and must never be shifted by the local
 * timezone, so the UTC components are read directly.
 */
export function formatDate(date: string | Date, _locale = 'pt-BR'): string {
  if (date == null) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(date: string | Date, locale = 'pt-BR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale);
}

export function formatDateShort(date: string | Date): string {
  if (date == null) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  // Move to the first day to avoid month-end overflow (e.g. Jan 31 + 1 month)
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTarget = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfTarget));
  return result;
}

export function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-success/10 text-success border-success/20',
    INACTIVE: 'bg-muted text-muted-foreground border-muted',
    OPEN: 'bg-primary/10 text-primary border-primary/20',
    CLOSED: 'bg-muted text-muted-foreground border-muted',
    PAID: 'bg-success/10 text-success border-success/20',
    PARTIALLY_PAID: 'bg-warning/10 text-warning border-warning/20',
    OVERDUE: 'bg-destructive/10 text-destructive border-destructive/20',
    PENDING: 'bg-warning/10 text-warning border-warning/20',
    CANCELLED: 'bg-muted text-muted-foreground border-muted',
    ACCEPTED: 'bg-success/10 text-success border-success/20',
    REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
    DISPUTED: 'bg-warning/10 text-warning border-warning/20',
  };
  return colors[status] || 'bg-muted text-muted-foreground border-muted';
}

export function getTransactionTypeColor(type: string): string {
  const colors: Record<string, string> = {
    EXPENSE: 'text-destructive',
    INCOME: 'text-success',
    TRANSFER: 'text-primary',
  };
  return colors[type] || 'text-foreground';
}

export function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    DAILY: 'Diário',
    WEEKLY: 'Semanal',
    BIWEEKLY: 'Quinzenal',
    MONTHLY: 'Mensal',
    QUARTERLY: 'Trimestral',
    SEMIANNUAL: 'Semestral',
    ANNUAL: 'Anual',
  };
  return labels[frequency] || frequency;
}

export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CHECKING: 'Conta Corrente',
    SAVINGS: 'Poupança',
    DIGITAL: 'Digital',
    SALARY: 'Salário',
    OTHER: 'Outra',
  };
  return labels[type] || type;
}

export function getCardBrandLabel(brand: string): string {
  const labels: Record<string, string> = {
    VISA: 'Visa',
    MASTERCARD: 'Mastercard',
    AMEX: 'American Express',
    ELO: 'Elo',
    HIPERCARD: 'Hipercard',
    OTHER: 'Outra',
  };
  return labels[brand] || brand;
}

export function getDebtTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    PERSONAL_LOAN: 'Empréstimo Pessoal',
    CREDIT_CARD: 'Cartão de Crédito',
    PURCHASE: 'Compra',
    BORROWED_MONEY: 'Dinheiro Emprestado',
    OTHER: 'Outro',
  };
  return labels[type] || type;
}