export type AccountType = 'CHECKING' | 'SAVINGS' | 'DIGITAL' | 'SALARY' | 'OTHER';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'ELO' | 'HIPERCARD' | 'OTHER';
export type CardStatus = 'ACTIVE' | 'INACTIVE';

export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE';

export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type PaymentMethod = 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'BOLETO' | 'OTHER';

export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
export type RecurringStatus = 'ACTIVE' | 'INACTIVE' | 'ENDED';

export type BillStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type DebtType = 'PERSONAL_LOAN' | 'CREDIT_CARD' | 'PURCHASE' | 'BORROWED_MONEY' | 'OTHER';
export type DebtStatus = 'ACTIVE' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'RENEGOTIATED';

export type SharedDebtStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAID' | 'CANCELLED' | 'DISPUTED';

export type PersonType = 'INDIVIDUAL' | 'COMPANY';

export type NotificationType =
  | 'INVOICE_DUE_SOON'
  | 'INVOICE_OVERDUE'
  | 'BILL_DUE_SOON'
  | 'BILL_OVERDUE'
  | 'INSTALLMENT_DUE_SOON'
  | 'DEBT_DUE_SOON'
  | 'SHARED_DEBT_ADDED'
  | 'SHARED_DEBT_UPDATED'
  | 'PAYMENT_RECEIVED'
  | 'SHARED_DEBT_PAYMENT'
  | 'SECURITY_ALERT';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH';

export type DateType = 'FIXED' | 'ADJUSTABLE';

export interface Money {
  cents: number;
  currency: 'BRL';
}

export function money(cents: number): Money {
  return { cents, currency: 'BRL' };
}

export function moneyFromReais(reais: number): Money {
  return { cents: Math.round(reais * 100), currency: 'BRL' };
}

export function moneyToReais(money: Money): number {
  return money.cents / 100;
}

export function addMoney(a: Money, b: Money): Money {
  return { cents: a.cents + b.cents, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  return { cents: a.cents - b.cents, currency: a.currency };
}

export function multiplyMoney(money: Money, factor: number): Money {
  return { cents: Math.round(money.cents * factor), currency: money.currency };
}

export function formatMoney(money: Money, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(money.cents / 100);
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DateRange {
  start: string;
  end: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  details?: Record<string, string[]>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  id: string;
  userId: string;
  name: string;
  institution: string;
  type: AccountType;
  number?: string;
  agency?: string;
  balance: Money;
  initialBalance: Money;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface CreditCard {
  id: string;
  userId: string;
  accountId?: string;
  name: string;
  institution: string;
  brand: CardBrand;
  last4: string;
  limit: Money;
  availableLimit: Money;
  closingDay: number;
  dueDay: number;
  status: CardStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  cardId: string;
  periodStart: string;
  periodEnd: string;
  closingDate: string;
  dueDate: string;
  total: Money;
  paid: Money;
  remaining: Money;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId?: string;
  cardId?: string;
  installmentPlanId?: string;
  description: string;
  amount: Money;
  type: TransactionType;
  categoryId?: string;
  category?: Category;
  date: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentPlan {
  id: string;
  userId: string;
  cardId: string;
  description: string;
  totalAmount: Money;
  installmentsCount: number;
  installmentValue: Money;
  startDate: string;
  firstInvoiceDate: string;
  categoryId?: string;
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: string;
  planId: string;
  invoiceId?: string;
  number: number;
  amount: Money;
  dueDate: string;
  status: InstallmentStatus;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringBill {
  id: string;
  userId: string;
  accountId?: string;
  cardId?: string;
  description: string;
  amount: Money;
  categoryId?: string;
  category?: Category;
  frequency: RecurringFrequency;
  dueDay: number;
  startDate: string;
  endDate?: string;
  status: RecurringStatus;
  nextDueDate: string;
  dateType: DateType;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  userId: string;
  accountId?: string;
  recurringBillId?: string;
  description: string;
  amount: Money;
  categoryId?: string;
  category?: Category;
  dueDate: string;
  paymentMethod?: PaymentMethod;
  status: BillStatus;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Debt {
  id: string;
  userId: string;
  description: string;
  totalAmount: Money;
  paidAmount: Money;
  remainingAmount: Money;
  dueDate: string;
  type: DebtType;
  relatedPersonId?: string;
  relatedPerson?: Person;
  notes?: string;
  status: DebtStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  userId: string;
  name: string;
  email?: string;
  type: PersonType;
  phone?: string;
  document?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedDebt {
  id: string;
  debtId: string;
  debtorUserId: string;
  creditorUserId: string;
  status: SharedDebtStatus;
  notifiedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  channels: NotificationChannel[];
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  invoiceDueSoon: boolean;
  invoiceOverdue: boolean;
  billDueSoon: boolean;
  billOverdue: boolean;
  installmentDueSoon: boolean;
  debtDueSoon: boolean;
  sharedDebtAdded: boolean;
  sharedDebtUpdated: boolean;
  paymentReceived: boolean;
  securityAlert: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

export interface Passkey {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  ip?: string;
  userAgent?: string;
  deviceName?: string;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalBalance: Money;
  accountsBalance: Array<{ accountId: string; name: string; balance: Money }>;
  totalExpensesMonth: Money;
  totalIncomeMonth: Money;
  pendingBillsTotal: Money;
  debtsTotal: Money;
  owedTotal: Money;
  currentInvoices: Array<{ cardId: string; name: string; total: Money; dueDate: string }>;
  upcomingInvoices: Array<{ cardId: string; name: string; estimatedTotal: Money; dueDate: string }>;
  upcomingBills: Array<{ id: string; description: string; amount: Money; dueDate: string }>;
  upcomingInstallments: Array<{ planId: string; description: string; amount: Money; dueDate: string }>;
  fixedExpenses: Money;
  cashflowProjection: CashflowMonth[];
}

export interface CashflowMonth {
  month: string;
  bills: Money;
  installments: Money;
  cards: Money;
  totalCommitted: Money;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  categoryIds?: string[];
  accountIds?: string[];
  cardIds?: string[];
  transactionTypes?: TransactionType[];
}

export interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  total: Money;
  percentage: number;
  transactionCount: number;
}

export interface SpendingByPeriod {
  period: string;
  total: Money;
  expenses: Money;
  income: Money;
}

export interface SpendingByAccount {
  accountId: string;
  accountName: string;
  total: Money;
  transactionCount: number;
}

export interface SpendingByCard {
  cardId: string;
  cardName: string;
  total: Money;
  transactionCount: number;
}

export interface FixedVsVariable {
  fixed: Money;
  variable: Money;
  installments: Money;
  recurring: Money;
}

export interface DebtsReport {
  toPay: Array<{ id: string; description: string; total: Money; remaining: Money; dueDate: string }>;
  toReceive: Array<{ id: string; description: string; total: Money; remaining: Money; dueDate: string }>;
}

export interface InvoicesReport {
  cardId: string;
  cardName: string;
  invoices: Array<{
    id: string;
    period: string;
    total: Money;
    paid: Money;
    status: InvoiceStatus;
    dueDate: string;
  }>;
}

export interface CashflowProjection {
  months: CashflowMonth[];
  totalProjected: Money;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
  passkeyCredential?: PublicKeyCredential;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface PasskeyRegistrationStartResponse {
  challenge: string;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  rp: {
    id: string;
    name: string;
  };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout: number;
  attestation: 'none' | 'direct' | 'indirect';
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey: boolean;
    userVerification: 'required' | 'preferred' | 'discouraged';
  };
}

export interface PasskeyAuthenticationStartResponse {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials: Array<{
    type: 'public-key';
    id: string;
    transports?: Array<'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'>;
  }>;
  userVerification: 'required' | 'preferred' | 'discouraged';
}

export interface WebAuthnCredential {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject?: string;
    authenticatorData?: string;
    signature?: string;
    userHandle?: string;
  };
  type: 'public-key';
  transports?: Array<'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'>;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'pt-BR';
  currency: 'BRL';
  dateFormat: 'DD/MM/YYYY';
  firstDayOfWeek: 0 | 1;
  defaultAccountId?: string;
  defaultCardId?: string;
  dashboardLayout: string[];
}

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: 'ok' | 'down';
    redis: 'ok' | 'down';
  };
  version: string;
}