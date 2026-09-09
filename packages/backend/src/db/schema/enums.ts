import { pgEnum } from 'drizzle-orm/pg-core';

export const accountTypeEnum = pgEnum('account_type', [
  'CHECKING', 'SAVINGS', 'DIGITAL', 'SALARY', 'OTHER'
]);

export const accountStatusEnum = pgEnum('account_status', [
  'ACTIVE', 'INACTIVE'
]);

export const cardBrandEnum = pgEnum('card_brand', [
  'VISA', 'MASTERCARD', 'AMEX', 'ELO', 'HIPERCARD', 'OTHER'
]);

export const cardStatusEnum = pgEnum('card_status', [
  'ACTIVE', 'INACTIVE'
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'OPEN', 'CLOSED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'EXPENSE', 'INCOME', 'TRANSFER'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER'
]);

export const installmentStatusEnum = pgEnum('installment_status', [
  'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'
]);

export const recurringFrequencyEnum = pgEnum('recurring_frequency', [
  'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'
]);

export const recurringStatusEnum = pgEnum('recurring_status', [
  'ACTIVE', 'INACTIVE', 'ENDED'
]);

export const billStatusEnum = pgEnum('bill_status', [
  'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'
]);

export const debtTypeEnum = pgEnum('debt_type', [
  'PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER'
]);

export const debtStatusEnum = pgEnum('debt_status', [
  'ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED'
]);

export const sharedDebtStatusEnum = pgEnum('shared_debt_status', [
  'PENDING', 'ACCEPTED', 'REJECTED', 'PAID', 'CANCELLED', 'DISPUTED'
]);

export const personTypeEnum = pgEnum('person_type', [
  'INDIVIDUAL', 'COMPANY'
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'INVOICE_DUE_SOON', 'INVOICE_OVERDUE', 'BILL_DUE_SOON', 'BILL_OVERDUE',
  'INSTALLMENT_DUE_SOON', 'DEBT_DUE_SOON', 'SHARED_DEBT_ADDED', 'SHARED_DEBT_UPDATED',
  'PAYMENT_RECEIVED', 'SHARED_DEBT_PAYMENT', 'SECURITY_ALERT'
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'IN_APP', 'EMAIL', 'PUSH'
]);

export const dateTypeEnum = pgEnum('date_type', [
  'FIXED', 'ADJUSTABLE'
]);