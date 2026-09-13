import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  nameSchema,
  uuidSchema,
  moneyCentsSchema,
  positiveMoneyCentsSchema,
  civilDateSchema,
  phoneSchema,
  documentSchema,
} from '@oxedindin/shared';

export const moneySchema = moneyCentsSchema;

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: civilDateSchema.optional(),
  endDate: civilDateSchema.optional(),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token inválido.'),
  password: passwordSchema,
});

export const accountTypeSchema = z.enum(['CHECKING', 'SAVINGS', 'DIGITAL', 'SALARY', 'OTHER']);
export const accountStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const createAccountSchema = z.object({
  name: nameSchema,
  institution: z.string().trim().min(1, 'Informe a instituição.').max(100),
  type: accountTypeSchema,
  number: z.string().trim().max(20).optional(),
  agency: z.string().trim().max(10).optional(),
  initialBalance: moneyCentsSchema.default(0),
  notes: z.string().max(500).optional(),
});

export const updateAccountSchema = z.object({
  name: nameSchema.optional(),
  institution: z.string().trim().min(1, 'Informe a instituição.').max(100).optional(),
  type: accountTypeSchema.optional(),
  number: z.string().trim().max(20).nullable().optional(),
  agency: z.string().trim().max(10).nullable().optional(),
  status: accountStatusSchema.optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const cardBrandSchema = z.enum(['VISA', 'MASTERCARD', 'AMEX', 'ELO', 'HIPERCARD', 'OTHER']);
export const cardStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

const last4Schema = z.string().regex(/^\d{4}$/, 'Informe os 4 últimos dígitos do cartão.');

const closingDaySchema = z
  .number({ invalid_type_error: 'Informe o dia de fechamento.' })
  .int('Dia de fechamento inválido.')
  .min(1, 'O dia de fechamento deve ser entre 1 e 31.')
  .max(31, 'O dia de fechamento deve ser entre 1 e 31.');

const dueDaySchema = z
  .number({ invalid_type_error: 'Informe o dia de vencimento.' })
  .int('Dia de vencimento inválido.')
  .min(1, 'O dia de vencimento deve ser entre 1 e 31.')
  .max(31, 'O dia de vencimento deve ser entre 1 e 31.');

export const createCardSchema = z.object({
  name: nameSchema,
  institution: z.string().trim().min(1, 'Informe a instituição.').max(100),
  brand: cardBrandSchema,
  last4: last4Schema,
  limit: positiveMoneyCentsSchema,
  closingDay: closingDaySchema,
  dueDay: dueDaySchema,
  accountId: uuidSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const updateCardSchema = z.object({
  name: nameSchema.optional(),
  institution: z.string().trim().min(1).max(100).optional(),
  brand: cardBrandSchema.optional(),
  last4: last4Schema.optional(),
  limit: positiveMoneyCentsSchema.optional(),
  closingDay: closingDaySchema.optional(),
  dueDay: dueDaySchema.optional(),
  accountId: uuidSchema.nullable().optional(),
  status: cardStatusSchema.optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const transactionTypeSchema = z.enum(['EXPENSE', 'INCOME', 'TRANSFER']);
export const paymentMethodSchema = z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER']);

const optionalInstallmentsCountSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null) return undefined;
    if (typeof value === 'number' && Number.isNaN(value)) return undefined;
    return value;
  },
  z
    .number({ invalid_type_error: 'Informe o número de parcelas.' })
    .int('Número de parcelas inválido.')
    .positive('O número de parcelas deve ser positivo.')
    .max(60, 'Máximo de 60 parcelas.')
    .optional(),
);

export const createTransactionSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  amount: positiveMoneyCentsSchema,
  type: transactionTypeSchema,
  categoryId: uuidSchema.optional(),
  date: civilDateSchema,
  paymentMethod: paymentMethodSchema,
  accountId: uuidSchema.optional(),
  cardId: uuidSchema.optional(),
  notes: z.string().max(500).optional(),
  installmentsCount: optionalInstallmentsCountSchema,
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(50),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.').optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.').nullable().optional(),
});

export const createInstallmentPlanSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  totalAmount: positiveMoneyCentsSchema,
  installmentsCount: z
    .number({ invalid_type_error: 'Informe o número de parcelas.' })
    .int('Número de parcelas inválido.')
    .positive('O número de parcelas deve ser positivo.')
    .max(60, 'Máximo de 60 parcelas.'),
  startDate: civilDateSchema,
  firstInvoiceDate: civilDateSchema,
  cardId: uuidSchema,
  categoryId: uuidSchema.optional(),
});

export const recurringFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']);
export const recurringStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ENDED']);
export const dateTypeSchema = z.enum(['FIXED', 'ADJUSTABLE']);

export const createRecurringBillSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  amount: positiveMoneyCentsSchema,
  categoryId: uuidSchema.optional(),
  frequency: recurringFrequencySchema,
  dueDay: z.number({ invalid_type_error: 'Informe o dia de vencimento.' }).int().min(1).max(31),
  startDate: civilDateSchema,
  endDate: civilDateSchema.optional(),
  accountId: uuidSchema.optional(),
  cardId: uuidSchema.optional(),
  dateType: dateTypeSchema.default('FIXED'),
});

export const billStatusSchema = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']);

export const createBillSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  amount: positiveMoneyCentsSchema,
  categoryId: uuidSchema.optional(),
  dueDate: civilDateSchema,
  paymentMethod: paymentMethodSchema.optional(),
  accountId: uuidSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const debtTypeSchema = z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']);
export const debtStatusSchema = z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED']);

export const createDebtSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  totalAmount: positiveMoneyCentsSchema,
  dueDate: civilDateSchema,
  type: debtTypeSchema,
  relatedPersonId: uuidSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const personTypeSchema = z.enum(['INDIVIDUAL', 'COMPANY']);

export const createPersonSchema = z.object({
  name: nameSchema,
  email: emailSchema.optional(),
  type: personTypeSchema.default('INDIVIDUAL'),
  phone: phoneSchema.optional(),
  document: documentSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const shareDebtSchema = z.object({
  email: emailSchema,
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
  firstDayOfWeek: z.union([z.literal(0), z.literal(1)]).optional(),
  defaultAccountId: uuidSchema.nullable().optional(),
  defaultCardId: uuidSchema.nullable().optional(),
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
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateRecurringBillInput = z.infer<typeof createRecurringBillSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type ShareDebtInput = z.infer<typeof shareDebtSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;