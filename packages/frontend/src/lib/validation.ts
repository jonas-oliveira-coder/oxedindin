import { z } from 'zod';

export const moneySchema = z.number().int().min(0);

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(128),
  name: z.string().min(1, 'Nome é obrigatório').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(128),
});

export const accountTypeSchema = z.enum(['CHECKING', 'SAVINGS', 'DIGITAL', 'SALARY', 'OTHER']);
export const accountStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  institution: z.string().min(1, 'Instituição é obrigatória').max(100),
  type: accountTypeSchema,
  number: z.string().max(20).optional(),
  agency: z.string().max(10).optional(),
  initialBalance: z.number().int().default(0),
  notes: z.string().max(500).optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  institution: z.string().min(1).max(100).optional(),
  type: accountTypeSchema.optional(),
  number: z.string().max(20).nullable().optional(),
  agency: z.string().max(10).nullable().optional(),
  status: accountStatusSchema.optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const cardBrandSchema = z.enum(['VISA', 'MASTERCARD', 'AMEX', 'ELO', 'HIPERCARD', 'OTHER']);
export const cardStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const createCardSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  institution: z.string().min(1, 'Instituição é obrigatória').max(100),
  brand: cardBrandSchema,
  last4: z.string().length(4, 'Últimos 4 dígitos devem ter 4 caracteres'),
  limit: z.number().int().positive('Limite deve ser positivo'),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  accountId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
});

export const updateCardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  institution: z.string().min(1).max(100).optional(),
  brand: cardBrandSchema.optional(),
  last4: z.string().length(4).optional(),
  limit: z.number().int().positive().optional(),
  closingDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  accountId: z.string().cuid().nullable().optional(),
  status: cardStatusSchema.optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const transactionTypeSchema = z.enum(['EXPENSE', 'INCOME', 'TRANSFER']);
export const paymentMethodSchema = z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']);

export const createTransactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  amount: z.number().int().positive('Valor deve ser positivo'),
  type: transactionTypeSchema,
  categoryId: z.string().cuid().optional(),
  date: z.string().datetime(),
  paymentMethod: paymentMethodSchema,
  accountId: z.string().cuid().optional(),
  cardId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
});

export const createInstallmentPlanSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  totalAmount: z.number().int().positive('Valor total deve ser positivo'),
  installmentsCount: z.number().int().positive('Quantidade de parcelas deve ser positiva').max(60),
  startDate: z.string().datetime(),
  firstInvoiceDate: z.string().datetime(),
  cardId: z.string().cuid(),
  categoryId: z.string().cuid().optional(),
});

export const recurringFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']);
export const recurringStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ENDED']);
export const dateTypeSchema = z.enum(['FIXED', 'ADJUSTABLE']);

export const createRecurringBillSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  amount: z.number().int().positive('Valor deve ser positivo'),
  categoryId: z.string().cuid().optional(),
  frequency: recurringFrequencySchema,
  dueDay: z.number().int().min(1).max(31),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  accountId: z.string().cuid().optional(),
  cardId: z.string().cuid().optional(),
  dateType: dateTypeSchema.default('FIXED'),
});

export const billStatusSchema = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']);

export const createBillSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  amount: z.number().int().positive('Valor deve ser positivo'),
  categoryId: z.string().cuid().optional(),
  dueDate: z.string().datetime(),
  paymentMethod: paymentMethodSchema.optional(),
  accountId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
});

export const debtTypeSchema = z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']);
export const debtStatusSchema = z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']);

export const createDebtSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  totalAmount: z.number().int().positive('Valor total deve ser positivo'),
  dueDate: z.string().datetime(),
  type: debtTypeSchema,
  relatedPersonId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
});

export const personTypeSchema = z.enum(['INDIVIDUAL', 'COMPANY']);

export const createPersonSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  email: z.string().email('Email inválido').optional(),
  type: personTypeSchema.default('INDIVIDUAL'),
  phone: z.string().max(20).optional(),
  document: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

export const shareDebtSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const notificationPreferencesSchema = z.object({
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
});

export const passwordGeneratorSchema = z.object({
  length: z.number().int().min(8).max(128).default(16),
  uppercase: z.boolean().default(true),
  lowercase: z.boolean().default(true),
  numbers: z.boolean().default(true),
  symbols: z.boolean().default(true),
});

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.literal('pt-BR').optional(),
  currency: z.literal('BRL').optional(),
  dateFormat: z.string().optional(),
  firstDayOfWeek: z.enum([0, 1]).optional(),
  defaultAccountId: z.string().cuid().nullable().optional(),
  defaultCardId: z.string().cuid().nullable().optional(),
  dashboardLayout: z.array(z.string()).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateInstallmentPlanInput = z.infer<typeof createInstallmentPlanSchema>;
export type CreateRecurringBillInput = z.infer<typeof createRecurringBillSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type ShareDebtInput = z.infer<typeof shareDebtSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;