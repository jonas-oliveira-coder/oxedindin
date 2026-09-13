import {
  pgTable, text, timestamp, boolean, bigint, integer, jsonb, uuid, uniqueIndex, index, primaryKey
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import {
  accountTypeEnum, accountStatusEnum, cardBrandEnum, cardStatusEnum,
  invoiceStatusEnum, transactionTypeEnum, paymentMethodEnum,
  installmentStatusEnum, recurringFrequencyEnum, recurringStatusEnum,
  billStatusEnum, debtTypeEnum, debtStatusEnum, sharedDebtStatusEnum,
  personTypeEnum, notificationTypeEnum, notificationChannelEnum, dateTypeEnum
} from './enums.js';

export const user = pgTable('User', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: boolean('email_verified').default(false).notNull(),
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bankAccount = pgTable('BankAccount', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  institution: text('institution').notNull(),
  type: accountTypeEnum('type').notNull(),
  number: text('number'),
  agency: text('agency'),
  balanceCents: bigint('balance_cents', { mode: 'bigint' }).default(sql`0`) .notNull(),
  initialBalanceCents: bigint('initial_balance_cents', { mode: 'bigint' }).default(sql`0`) .notNull(),
  status: accountStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
}, (table) => ({
  userIdIdx: index('bank_account_user_id_idx').on(table.userId),
  userIdStatusIdx: index('bank_account_user_id_status_idx').on(table.userId, table.status),
}));

export const creditCard = pgTable('CreditCard', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => bankAccount.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  institution: text('institution').notNull(),
  brand: cardBrandEnum('brand').notNull(),
  last4: text('last4').notNull(),
  limitCents: bigint('limit_cents', { mode: 'bigint' }).notNull(),
  availableLimitCents: bigint('available_limit_cents', { mode: 'bigint' }).notNull(),
  closingDay: integer('closing_day').notNull(),
  dueDay: integer('due_day').notNull(),
  status: cardStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
}, (table) => ({
  userIdIdx: index('credit_card_user_id_idx').on(table.userId),
  userIdStatusIdx: index('credit_card_user_id_status_idx').on(table.userId, table.status),
  accountIdIdx: index('credit_card_account_id_idx').on(table.accountId),
}));

export const invoice = pgTable('Invoice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cardId: text('card_id').notNull().references(() => creditCard.id, { onDelete: 'cascade' }),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  closingDate: timestamp('closing_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  totalCents: bigint('total_cents', { mode: 'bigint' }).default(sql`0`) .notNull(),
  paidCents: bigint('paid_cents', { mode: 'bigint' }).default(sql`0`) .notNull(),
  remainingCents: bigint('remaining_cents', { mode: 'bigint' }).default(sql`0`) .notNull(),
  status: invoiceStatusEnum('status').default('OPEN').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  cardIdIdx: index('invoice_card_id_idx').on(table.cardId),
  cardIdStatusIdx: index('invoice_card_id_status_idx').on(table.cardId, table.status),
  dueDateIdx: index('invoice_due_date_idx').on(table.dueDate),
  uniquePeriod: uniqueIndex('invoice_card_id_period_start_period_end_key').on(table.cardId, table.periodStart, table.periodEnd),
}));

export const category = pgTable('Category', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('category_user_id_idx').on(table.userId),
  userIdNameUnique: uniqueIndex('category_user_id_name_key').on(table.userId, table.name),
}));

export const transaction = pgTable('Transaction', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => bankAccount.id, { onDelete: 'set null' }),
  cardId: text('card_id').references(() => creditCard.id, { onDelete: 'set null' }),
  installmentPlanId: text('installment_plan_id').references(() => installmentPlan.id, { onDelete: 'set null' }),
  invoiceId: text('invoice_id').references(() => invoice.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('transaction_user_id_idx').on(table.userId),
  userIdDateIdx: index('transaction_user_id_date_idx').on(table.userId, table.date),
  accountIdIdx: index('transaction_account_id_idx').on(table.accountId),
  cardIdIdx: index('transaction_card_id_idx').on(table.cardId),
  installmentPlanIdIdx: index('transaction_installment_plan_id_idx').on(table.installmentPlanId),
  invoiceIdIdx: index('transaction_invoice_id_idx').on(table.invoiceId),
  categoryIdIdx: index('transaction_category_id_idx').on(table.categoryId),
}));

export const installmentPlan = pgTable('InstallmentPlan', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  cardId: text('card_id').notNull().references(() => creditCard.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  totalAmountCents: bigint('total_amount_cents', { mode: 'bigint' }).notNull(),
  installmentsCount: integer('installments_count').notNull(),
  installmentValueCents: bigint('installment_value_cents', { mode: 'bigint' }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  firstInvoiceDate: timestamp('first_invoice_date', { withTimezone: true }).notNull(),
  categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('installment_plan_user_id_idx').on(table.userId),
  cardIdIdx: index('installment_plan_card_id_idx').on(table.cardId),
  userIdStartDateIdx: index('installment_plan_user_id_start_date_idx').on(table.userId, table.startDate),
}));

export const installment = pgTable('Installment', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  planId: text('plan_id').notNull().references(() => installmentPlan.id, { onDelete: 'cascade' }),
  invoiceId: text('invoice_id').references(() => invoice.id, { onDelete: 'set null' }),
  number: integer('number').notNull(),
  amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  status: installmentStatusEnum('status').default('PENDING').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  planIdIdx: index('installment_plan_id_idx').on(table.planId),
  invoiceIdIdx: index('installment_invoice_id_idx').on(table.invoiceId),
  dueDateIdx: index('installment_due_date_idx').on(table.dueDate),
  statusIdx: index('installment_status_idx').on(table.status),
  uniquePlanNumber: uniqueIndex('installment_plan_id_number_key').on(table.planId, table.number),
}));

export const recurringBill = pgTable('RecurringBill', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => bankAccount.id, { onDelete: 'set null' }),
  cardId: text('card_id').references(() => creditCard.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
  frequency: recurringFrequencyEnum('frequency').notNull(),
  dueDay: integer('due_day').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  status: recurringStatusEnum('status').default('ACTIVE').notNull(),
  nextDueDate: timestamp('next_due_date', { withTimezone: true }).notNull(),
  dateType: dateTypeEnum('date_type').default('FIXED').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('recurring_bill_user_id_idx').on(table.userId),
  userIdStatusIdx: index('recurring_bill_user_id_status_idx').on(table.userId, table.status),
  nextDueDateIdx: index('recurring_bill_next_due_date_idx').on(table.nextDueDate),
}));

export const bill = pgTable('Bill', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => bankAccount.id, { onDelete: 'set null' }),
  cardId: text('card_id').references(() => creditCard.id, { onDelete: 'set null' }),
  recurringBillId: text('recurring_bill_id').references(() => recurringBill.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method'),
  status: billStatusEnum('status').default('PENDING').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('bill_user_id_idx').on(table.userId),
  userIdStatusIdx: index('bill_user_id_status_idx').on(table.userId, table.status),
  dueDateIdx: index('bill_due_date_idx').on(table.dueDate),
  recurringBillIdIdx: index('bill_recurring_bill_id_idx').on(table.recurringBillId),
  cardIdIdx: index('bill_card_id_idx').on(table.cardId),
}));

export const debt = pgTable('Debt', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  totalAmountCents: bigint('total_amount_cents', { mode: 'bigint' }).notNull(),
  paidAmountCents: bigint('paid_amount_cents', { mode: 'bigint' }).default(sql`0`) .notNull(),
  remainingAmountCents: bigint('remaining_amount_cents', { mode: 'bigint' }).default(sql`0`) .notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  type: debtTypeEnum('type').notNull(),
  relatedPersonId: text('related_person_id').references(() => person.id, { onDelete: 'set null' }),
  creditorId: text('creditor_id').references(() => user.id, { onDelete: 'set null' }),
  notes: text('notes'),
  status: debtStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('debt_user_id_idx').on(table.userId),
  userIdStatusIdx: index('debt_user_id_status_idx').on(table.userId, table.status),
  dueDateIdx: index('debt_due_date_idx').on(table.dueDate),
  relatedPersonIdIdx: index('debt_related_person_id_idx').on(table.relatedPersonId),
  creditorIdIdx: index('debt_creditor_id_idx').on(table.creditorId),
}));

export const person = pgTable('Person', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  type: personTypeEnum('type').default('INDIVIDUAL').notNull(),
  phone: text('phone'),
  document: text('document'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('person_user_id_idx').on(table.userId),
  userIdEmailIdx: index('person_user_id_email_idx').on(table.userId, table.email),
  userIdEmailUnique: uniqueIndex('person_user_id_email_key').on(table.userId, table.email),
}));

export const sharedDebt = pgTable('SharedDebt', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  debtId: text('debt_id').notNull().references(() => debt.id, { onDelete: 'cascade' }),
  debtorUserId: text('debtor_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  creditorUserId: text('creditor_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  personId: text('person_id').references(() => person.id, { onDelete: 'set null' }),
  status: sharedDebtStatusEnum('status').default('PENDING').notNull(),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  debtIdIdx: index('shared_debt_debt_id_idx').on(table.debtId),
  debtorUserIdIdx: index('shared_debt_debtor_user_id_idx').on(table.debtorUserId),
  creditorUserIdIdx: index('shared_debt_creditor_user_id_idx').on(table.creditorUserId),
  personIdIdx: index('shared_debt_person_id_idx').on(table.personId),
  statusIdx: index('shared_debt_status_idx').on(table.status),
  uniqueDebtDebtor: uniqueIndex('shared_debt_debt_id_debtor_user_id_key').on(table.debtId, table.debtorUserId),
}));

export const debtSplit = pgTable('DebtSplit', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  debtId: text('debt_id').notNull().references(() => debt.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull().references(() => person.id, { onDelete: 'cascade' }),
  amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  debtIdIdx: index('debt_split_debt_id_idx').on(table.debtId),
  personIdIdx: index('debt_split_person_id_idx').on(table.personId),
  userIdIdx: index('debt_split_user_id_idx').on(table.userId),
  uniqueDebtPerson: uniqueIndex('debt_split_debt_id_person_id_key').on(table.debtId, table.personId),
}));

export const notification = pgTable('Notification', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false).notNull(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  channels: notificationChannelEnum('channels').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('notification_user_id_idx').on(table.userId),
  userIdReadIdx: index('notification_user_id_read_idx').on(table.userId, table.read),
  createdAtIdx: index('notification_created_at_idx').on(table.createdAt),
}));

export const notificationPreferences = pgTable('NotificationPreferences', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  invoiceDueSoon: boolean('invoice_due_soon').default(true).notNull(),
  invoiceOverdue: boolean('invoice_overdue').default(true).notNull(),
  billDueSoon: boolean('bill_due_soon').default(true).notNull(),
  billOverdue: boolean('bill_overdue').default(true).notNull(),
  installmentDueSoon: boolean('installment_due_soon').default(true).notNull(),
  debtDueSoon: boolean('debt_due_soon').default(true).notNull(),
  sharedDebtAdded: boolean('shared_debt_added').default(true).notNull(),
  sharedDebtUpdated: boolean('shared_debt_updated').default(true).notNull(),
  paymentReceived: boolean('payment_received').default(true).notNull(),
  securityAlert: boolean('security_alert').default(true).notNull(),
  emailEnabled: boolean('email_enabled').default(false).notNull(),
  pushEnabled: boolean('push_enabled').default(false).notNull(),
  inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const passkey = pgTable('Passkey', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: bigint('counter', { mode: 'bigint' }).default(sql`0`) .notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => ({
  userIdIdx: index('passkey_user_id_idx').on(table.userId),
}));

export const session = pgTable('Session', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  deviceName: text('device_name'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('session_user_id_idx').on(table.userId),
  tokenHashIdx: index('session_token_hash_idx').on(table.tokenHash),
  expiresAtIdx: index('session_expires_at_idx').on(table.expiresAt),
}));

export const auditLog = pgTable('AuditLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('audit_log_user_id_idx').on(table.userId),
  entityTypeEntityIdIdx: index('audit_log_entity_type_entity_id_idx').on(table.entityType, table.entityId),
  createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
}));

// Relations
export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(bankAccount),
  cards: many(creditCard),
  transactions: many(transaction),
  installmentPlans: many(installmentPlan),
  recurringBills: many(recurringBill),
  bills: many(bill),
  debts: many(debt),
  owedDebts: many(debt, { relationName: 'owedDebts' }),
  categories: many(category),
  people: many(person),
  sharedDebtsAsDebtor: many(sharedDebt, { relationName: 'debtorSharedDebts' }),
  sharedDebtsAsCreditor: many(sharedDebt, { relationName: 'creditorSharedDebts' }),
  notifications: many(notification),
  notificationPrefs: one(notificationPreferences),
  passkeys: many(passkey),
  sessions: many(session),
  auditLogs: many(auditLog),
}));

export const bankAccountRelations = relations(bankAccount, ({ one, many }) => ({
  user: one(user, { fields: [bankAccount.userId], references: [user.id] }),
  cards: many(creditCard),
  transactions: many(transaction),
  recurringBills: many(recurringBill),
  bills: many(bill),
}));

export const creditCardRelations = relations(creditCard, ({ one, many }) => ({
  user: one(user, { fields: [creditCard.userId], references: [user.id] }),
  account: one(bankAccount, { fields: [creditCard.accountId], references: [bankAccount.id] }),
  invoices: many(invoice),
  transactions: many(transaction),
  installmentPlans: many(installmentPlan),
  recurringBills: many(recurringBill),
  bills: many(bill),
}));

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
  card: one(creditCard, { fields: [invoice.cardId], references: [creditCard.id] }),
  transactions: many(transaction),
  installments: many(installment),
}));

export const categoryRelations = relations(category, ({ one, many }) => ({
  user: one(user, { fields: [category.userId], references: [user.id] }),
  transactions: many(transaction),
  installmentPlans: many(installmentPlan),
  recurringBills: many(recurringBill),
  bills: many(bill),
}));

export const transactionRelations = relations(transaction, ({ one }) => ({
  user: one(user, { fields: [transaction.userId], references: [user.id] }),
  account: one(bankAccount, { fields: [transaction.accountId], references: [bankAccount.id] }),
  card: one(creditCard, { fields: [transaction.cardId], references: [creditCard.id] }),
  installmentPlan: one(installmentPlan, { fields: [transaction.installmentPlanId], references: [installmentPlan.id] }),
  invoice: one(invoice, { fields: [transaction.invoiceId], references: [invoice.id] }),
  category: one(category, { fields: [transaction.categoryId], references: [category.id] }),
}));

export const installmentPlanRelations = relations(installmentPlan, ({ one, many }) => ({
  user: one(user, { fields: [installmentPlan.userId], references: [user.id] }),
  card: one(creditCard, { fields: [installmentPlan.cardId], references: [creditCard.id] }),
  category: one(category, { fields: [installmentPlan.categoryId], references: [category.id] }),
  installments: many(installment),
  transactions: many(transaction),
}));

export const installmentRelations = relations(installment, ({ one }) => ({
  plan: one(installmentPlan, { fields: [installment.planId], references: [installmentPlan.id] }),
  invoice: one(invoice, { fields: [installment.invoiceId], references: [invoice.id] }),
}));

export const recurringBillRelations = relations(recurringBill, ({ one, many }) => ({
  user: one(user, { fields: [recurringBill.userId], references: [user.id] }),
  account: one(bankAccount, { fields: [recurringBill.accountId], references: [bankAccount.id] }),
  card: one(creditCard, { fields: [recurringBill.cardId], references: [creditCard.id] }),
  category: one(category, { fields: [recurringBill.categoryId], references: [category.id] }),
  bills: many(bill),
}));

export const billRelations = relations(bill, ({ one }) => ({
  user: one(user, { fields: [bill.userId], references: [user.id] }),
  account: one(bankAccount, { fields: [bill.accountId], references: [bankAccount.id] }),
  card: one(creditCard, { fields: [bill.cardId], references: [creditCard.id] }),
  recurringBill: one(recurringBill, { fields: [bill.recurringBillId], references: [recurringBill.id] }),
  category: one(category, { fields: [bill.categoryId], references: [category.id] }),
}));

export const debtRelations = relations(debt, ({ one, many }) => ({
  user: one(user, { fields: [debt.userId], references: [user.id] }),
  relatedPerson: one(person, { fields: [debt.relatedPersonId], references: [person.id], relationName: 'owedDebts' }),
  creditor: one(user, { fields: [debt.creditorId], references: [user.id], relationName: 'owedDebts' }),
  sharedDebts: many(sharedDebt),
  debtSplits: many(debtSplit),
}));

export const personRelations = relations(person, ({ one, many }) => ({
  user: one(user, { fields: [person.userId], references: [user.id] }),
  debts: many(debt, { relationName: 'owedDebts' }),
  sharedDebts: many(sharedDebt),
  debtSplits: many(debtSplit),
}));

export const debtSplitRelations = relations(debtSplit, ({ one }) => ({
  user: one(user, { fields: [debtSplit.userId], references: [user.id] }),
  debt: one(debt, { fields: [debtSplit.debtId], references: [debt.id] }),
  person: one(person, { fields: [debtSplit.personId], references: [person.id] }),
}));

export const sharedDebtRelations = relations(sharedDebt, ({ one }) => ({
  debt: one(debt, { fields: [sharedDebt.debtId], references: [debt.id] }),
  debtor: one(user, { fields: [sharedDebt.debtorUserId], references: [user.id], relationName: 'debtorSharedDebts' }),
  creditor: one(user, { fields: [sharedDebt.creditorUserId], references: [user.id], relationName: 'creditorSharedDebts' }),
  person: one(person, { fields: [sharedDebt.personId], references: [person.id] }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userId], references: [user.id] }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(user, { fields: [notificationPreferences.userId], references: [user.id] }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, { fields: [passkey.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(user, { fields: [auditLog.userId], references: [user.id] }),
}));

// Export all tables for easy importing
export const schema = {
  user,
  bankAccount,
  creditCard,
  invoice,
  category,
  transaction,
  installmentPlan,
  installment,
  recurringBill,
  bill,
  debt,
  person,
  sharedDebt,
  debtSplit,
  notification,
  notificationPreferences,
  passkey,
  session,
  auditLog,
};