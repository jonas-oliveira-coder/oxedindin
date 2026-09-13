import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  nameSchema,
  documentSchema,
  phoneSchema,
  uuidSchema,
  moneyCentsSchema,
  positiveMoneyCentsSchema,
  civilDateSchema,
  paginationSchema,
} from '@oxedindin/shared';

export const accountTypeEnum = z.enum(['CHECKING', 'SAVINGS', 'DIGITAL', 'SALARY', 'OTHER']);
export const accountStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export const cardBrandEnum = z.enum(['VISA', 'MASTERCARD', 'AMEX', 'ELO', 'HIPERCARD', 'OTHER']);
export const cardStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
export const invoiceStatusEnum = z.enum(['OPEN', 'CLOSED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE']);
export const transactionTypeEnum = z.enum(['EXPENSE', 'INCOME', 'TRANSFER']);
export const paymentMethodEnum = z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']);
export const installmentStatusEnum = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']);
export const recurringFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']);
export const recurringStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ENDED']);
export const billStatusEnum = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']);
export const debtTypeEnum = z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']);
export const debtStatusEnum = z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']);
export const personTypeEnum = z.enum(['INDIVIDUAL', 'COMPANY']);
export const dateTypeEnum = z.enum(['FIXED', 'ADJUSTABLE']);

export const dateRangeSchema = z.object({
  startDate: civilDateSchema.optional(),
  endDate: civilDateSchema.optional(),
});

export const moneySchema = z.object({
  cents: z.number().finite().int(),
  currency: z.literal('BRL'),
});

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const userSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  name: nameSchema,
  avatarUrl: z.string().url().nullable().optional(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Informe a senha.'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: passwordSchema,
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token inválido.'),
    password: passwordSchema,
  }),
});

export const bankAccountSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: nameSchema,
  institution: z.string().min(1, 'Informe a instituição.').max(100),
  type: accountTypeEnum,
  number: z.string().max(20).nullable().optional(),
  agency: z.string().max(10).nullable().optional(),
  balanceCents: moneyCentsSchema,
  initialBalanceCents: moneyCentsSchema,
  status: accountStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  notes: z.string().max(500).nullable().optional(),
});

export const createAccountSchema = z.object({
  body: z.object({
    name: nameSchema,
    institution: z.string().trim().min(1, 'Informe a instituição.').max(100),
    type: accountTypeEnum.default('CHECKING'),
    number: z.string().trim().max(20).optional(),
    agency: z.string().trim().max(10).optional(),
    initialBalance: moneyCentsSchema.default(0),
    notes: z.string().max(500).optional(),
  }),
});

export const updateAccountSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: nameSchema.optional(),
    institution: z.string().trim().min(1, 'Informe a instituição.').max(100).optional(),
    type: accountTypeEnum.optional(),
    number: z.string().trim().max(20).nullable().optional(),
    agency: z.string().trim().max(10).nullable().optional(),
    status: accountStatusEnum.optional(),
    notes: z.string().max(500).nullable().optional(),
  }),
});

const last4Schema = z.string().regex(/^\d{4}$/, 'Informe os 4 últimos dígitos do cartão.');

export const creditCardSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  accountId: uuidSchema.nullable().optional(),
  name: nameSchema,
  institution: z.string().min(1).max(100),
  brand: cardBrandEnum,
  last4: last4Schema,
  limitCents: moneyCentsSchema,
  availableLimitCents: moneyCentsSchema,
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  status: cardStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  notes: z.string().max(500).nullable().optional(),
});

export const createCardSchema = z.object({
  body: z.object({
    name: nameSchema,
    institution: z.string().trim().min(1, 'Informe a instituição.').max(100),
    brand: cardBrandEnum,
    last4: last4Schema,
    limit: positiveMoneyCentsSchema,
    closingDay: z.number().int('Dia de fechamento inválido.').min(1, 'O dia de fechamento deve ser entre 1 e 31.').max(31, 'O dia de fechamento deve ser entre 1 e 31.'),
    dueDay: z.number().int('Dia de vencimento inválido.').min(1, 'O dia de vencimento deve ser entre 1 e 31.').max(31, 'O dia de vencimento deve ser entre 1 e 31.'),
    accountId: uuidSchema.optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const updateCardSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: nameSchema.optional(),
    institution: z.string().trim().min(1).max(100).optional(),
    brand: cardBrandEnum.optional(),
    last4: last4Schema.optional(),
    limit: positiveMoneyCentsSchema.optional(),
    closingDay: z.number().int().min(1).max(31).optional(),
    dueDay: z.number().int().min(1).max(31).optional(),
    accountId: uuidSchema.nullable().optional(),
    status: cardStatusEnum.optional(),
    notes: z.string().max(500).nullable().optional(),
  }),
});

export const invoiceSchema = z.object({
  id: uuidSchema,
  cardId: uuidSchema,
  periodStart: civilDateSchema,
  periodEnd: civilDateSchema,
  closingDate: civilDateSchema,
  dueDate: civilDateSchema,
  totalCents: moneyCentsSchema,
  paidCents: moneyCentsSchema,
  remainingCents: moneyCentsSchema,
  status: invoiceStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const categorySchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: z.string().min(1, 'Informe o nome.').max(50),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.').nullable().optional(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Informe o nome.').max(50),
    icon: z.string().max(50).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.').optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().trim().min(1).max(50).optional(),
    icon: z.string().max(50).nullable().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.').nullable().optional(),
  }),
});

export const transactionSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  accountId: uuidSchema.nullable().optional(),
  cardId: uuidSchema.nullable().optional(),
  installmentPlanId: uuidSchema.nullable().optional(),
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  amountCents: positiveMoneyCentsSchema,
  type: transactionTypeEnum,
  categoryId: uuidSchema.nullable().optional(),
  date: civilDateSchema,
  paymentMethod: paymentMethodEnum,
  notes: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createTransactionSchema = z.object({
  body: z.object({
    description: z.string().trim().min(1, 'Informe a descrição.').max(200),
    amount: positiveMoneyCentsSchema,
    type: transactionTypeEnum,
    categoryId: uuidSchema.optional(),
    date: civilDateSchema,
    paymentMethod: paymentMethodEnum,
    accountId: uuidSchema.optional(),
    cardId: uuidSchema.optional(),
    notes: z.string().max(500).optional(),
    installmentsCount: z.number().int('Número de parcelas inválido.').positive('O número de parcelas deve ser positivo.').max(60, 'Máximo de 60 parcelas.').optional(),
  }),
});

export const installmentPlanSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  cardId: uuidSchema,
  description: z.string().trim().min(1).max(200),
  totalAmountCents: positiveMoneyCentsSchema,
  installmentsCount: z.number().int().positive().max(60),
  installmentValueCents: positiveMoneyCentsSchema,
  startDate: civilDateSchema,
  firstInvoiceDate: civilDateSchema,
  categoryId: uuidSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createInstallmentPlanSchema = z.object({
  body: z.object({
    description: z.string().trim().min(1, 'Informe a descrição.').max(200),
    totalAmount: positiveMoneyCentsSchema,
    installmentsCount: z.number().int('Número de parcelas inválido.').positive('O número de parcelas deve ser positivo.').max(60, 'Máximo de 60 parcelas.'),
    startDate: civilDateSchema,
    firstInvoiceDate: civilDateSchema,
    cardId: uuidSchema,
    categoryId: uuidSchema.optional(),
  }),
});

export const installmentSchema = z.object({
  id: uuidSchema,
  planId: uuidSchema,
  invoiceId: uuidSchema.nullable().optional(),
  number: z.number().int().positive(),
  amountCents: positiveMoneyCentsSchema,
  dueDate: civilDateSchema,
  status: installmentStatusEnum,
  paidAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const recurringBillSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  accountId: uuidSchema.nullable().optional(),
  cardId: uuidSchema.nullable().optional(),
  description: z.string().trim().min(1).max(200),
  amountCents: positiveMoneyCentsSchema,
  categoryId: uuidSchema.nullable().optional(),
  frequency: recurringFrequencyEnum,
  dueDay: z.number().int().min(1).max(31),
  startDate: civilDateSchema,
  endDate: civilDateSchema.nullable().optional(),
  status: recurringStatusEnum,
  nextDueDate: civilDateSchema,
  dateType: dateTypeEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createRecurringBillSchema = z.object({
  body: z.object({
    description: z.string().trim().min(1, 'Informe a descrição.').max(200),
    amount: positiveMoneyCentsSchema,
    categoryId: uuidSchema.optional(),
    frequency: recurringFrequencyEnum,
    dueDay: z.number().int().min(1).max(31),
    startDate: civilDateSchema,
    endDate: civilDateSchema.optional(),
    accountId: uuidSchema.optional(),
    cardId: uuidSchema.optional(),
    dateType: dateTypeEnum.default('FIXED'),
  }),
});

export const billSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  accountId: uuidSchema.nullable().optional(),
  recurringBillId: uuidSchema.nullable().optional(),
  description: z.string().trim().min(1).max(200),
  amountCents: positiveMoneyCentsSchema,
  categoryId: uuidSchema.nullable().optional(),
  dueDate: civilDateSchema,
  paymentMethod: paymentMethodEnum.nullable().optional(),
  status: billStatusEnum,
  paidAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createBillSchema = z.object({
  body: z.object({
    description: z.string().trim().min(1, 'Informe a descrição.').max(200),
    amount: positiveMoneyCentsSchema,
    categoryId: uuidSchema.optional(),
    dueDate: civilDateSchema,
    paymentMethod: paymentMethodEnum.optional(),
    accountId: uuidSchema.optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const debtSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  description: z.string().trim().min(1).max(200),
  totalAmountCents: positiveMoneyCentsSchema,
  paidAmountCents: moneyCentsSchema,
  remainingAmountCents: moneyCentsSchema,
  dueDate: civilDateSchema,
  type: debtTypeEnum,
  relatedPersonId: uuidSchema.nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  status: debtStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createDebtSchema = z.object({
  body: z.object({
    description: z.string().trim().min(1, 'Informe a descrição.').max(200),
    totalAmount: positiveMoneyCentsSchema,
    dueDate: civilDateSchema,
    type: debtTypeEnum,
    relatedPersonId: uuidSchema.optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const personSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: nameSchema,
  email: emailSchema.nullable().optional(),
  type: personTypeEnum,
  phone: phoneSchema.nullable().optional(),
  document: documentSchema.nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createPersonSchema = z.object({
  body: z.object({
    name: nameSchema,
    email: emailSchema.optional(),
    type: personTypeEnum.default('INDIVIDUAL'),
    phone: phoneSchema.optional(),
    document: documentSchema.optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const sharedDebtSchema = z.object({
  id: uuidSchema,
  debtId: uuidSchema,
  debtorUserId: uuidSchema,
  creditorUserId: uuidSchema,
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'PAID', 'CANCELLED', 'DISPUTED']),
  notifiedAt: z.string().datetime().nullable().optional(),
  acceptedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const shareDebtSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const notificationSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  type: z.enum([
    'INVOICE_DUE_SOON',
    'INVOICE_OVERDUE',
    'BILL_DUE_SOON',
    'BILL_OVERDUE',
    'INSTALLMENT_DUE_SOON',
    'DEBT_DUE_SOON',
    'SHARED_DEBT_ADDED',
    'SHARED_DEBT_UPDATED',
    'PAYMENT_RECEIVED',
    'SHARED_DEBT_PAYMENT',
    'SECURITY_ALERT',
  ]),
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  relatedEntityType: z.string().nullable().optional(),
  relatedEntityId: z.string().nullable().optional(),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'PUSH'])),
  createdAt: z.string().datetime(),
});

export const notificationPreferencesSchema = z.object({
  userId: uuidSchema,
  invoiceDueSoon: z.boolean(),
  invoiceOverdue: z.boolean(),
  billDueSoon: z.boolean(),
  billOverdue: z.boolean(),
  installmentDueSoon: z.boolean(),
  debtDueSoon: z.boolean(),
  sharedDebtAdded: z.boolean(),
  sharedDebtUpdated: z.boolean(),
  paymentReceived: z.boolean(),
  securityAlert: z.boolean(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    invoiceDueSoon: z.boolean().optional(),
    invoiceOverdue: z.boolean().optional(),
    billDueSoon: z.boolean().optional(),
    billOverdue: z.boolean().optional(),
    installmentDueSoon: z.boolean().optional(),
    debtDueSoon: z.boolean().optional(),
    sharedDebtAdded: z.boolean().optional(),
    sharedDebtUpdated: z.boolean().optional(),
    paymentReceived: z.boolean().optional(),
    securityAlert: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
  }),
});

export const passkeySchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  credentialId: z.string(),
  publicKey: z.string(),
  counter: z.number().int(),
  name: z.string(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable().optional(),
});

export const sessionSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  tokenHash: z.string(),
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  deviceName: z.string().nullable().optional(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const auditLogSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  oldData: z.record(z.unknown()).nullable().optional(),
  newData: z.record(z.unknown()).nullable().optional(),
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const dashboardSummarySchema = z.object({
  totalBalance: moneySchema,
  accountsBalance: z.array(z.object({
    accountId: uuidSchema,
    name: z.string(),
    balance: moneySchema,
  })),
  totalExpensesMonth: moneySchema,
  totalIncomeMonth: moneySchema,
  pendingBillsTotal: moneySchema,
  debtsTotal: moneySchema,
  owedTotal: moneySchema,
  currentInvoices: z.array(z.object({
    cardId: uuidSchema,
    name: z.string(),
    total: moneySchema,
    dueDate: z.string().datetime(),
  })),
  upcomingInvoices: z.array(z.object({
    cardId: uuidSchema,
    name: z.string(),
    estimatedTotal: moneySchema,
    dueDate: z.string().datetime(),
  })),
  upcomingBills: z.array(z.object({
    id: uuidSchema,
    description: z.string(),
    amount: moneySchema,
    dueDate: z.string().datetime(),
  })),
  upcomingInstallments: z.array(z.object({
    planId: uuidSchema,
    description: z.string(),
    amount: moneySchema,
    dueDate: z.string().datetime(),
  })),
  fixedExpenses: moneySchema,
  cashflowProjection: z.array(z.object({
    month: z.string(),
    bills: moneySchema,
    installments: moneySchema,
    cards: moneySchema,
    totalCommitted: moneySchema,
  })),
});

export const reportFiltersSchema = z.object({
  query: z.object({
    startDate: civilDateSchema.optional(),
    endDate: civilDateSchema.optional(),
    categoryIds: z.string().optional().transform((v) => v?.split(',').filter(Boolean)),
    accountIds: z.string().optional().transform((v) => v?.split(',').filter(Boolean)),
    cardIds: z.string().optional().transform((v) => v?.split(',').filter(Boolean)),
    transactionTypes: z.string().optional().transform((v) => v?.split(',').filter(Boolean)),
  }),
});

export { paginationSchema };