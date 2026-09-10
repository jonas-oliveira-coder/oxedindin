CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('CHECKING', 'SAVINGS', 'DIGITAL', 'SALARY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."card_brand" AS ENUM('VISA', 'MASTERCARD', 'AMEX', 'ELO', 'HIPERCARD', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."date_type" AS ENUM('FIXED', 'ADJUSTABLE');--> statement-breakpoint
CREATE TYPE "public"."debt_status" AS ENUM('ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED');--> statement-breakpoint
CREATE TYPE "public"."debt_type" AS ENUM('PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."installment_status" AS ENUM('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('OPEN', 'CLOSED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('IN_APP', 'EMAIL', 'PUSH');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('INVOICE_DUE_SOON', 'INVOICE_OVERDUE', 'BILL_DUE_SOON', 'BILL_OVERDUE', 'INSTALLMENT_DUE_SOON', 'DEBT_DUE_SOON', 'SHARED_DEBT_ADDED', 'SHARED_DEBT_UPDATED', 'PAYMENT_RECEIVED', 'SHARED_DEBT_PAYMENT', 'SECURITY_ALERT');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('INDIVIDUAL', 'COMPANY');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('ACTIVE', 'INACTIVE', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."shared_debt_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'PAID', 'CANCELLED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('EXPENSE', 'INCOME', 'TRANSFER');--> statement-breakpoint
CREATE TABLE "AuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BankAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"institution" text NOT NULL,
	"type" "account_type" NOT NULL,
	"number" text,
	"agency" text,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"initial_balance_cents" bigint DEFAULT 0 NOT NULL,
	"status" "account_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "Bill" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"card_id" text,
	"recurring_bill_id" text,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"category_id" text,
	"due_date" timestamp with time zone NOT NULL,
	"payment_method" "payment_method",
	"status" "bill_status" DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Category" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CreditCard" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"name" text NOT NULL,
	"institution" text NOT NULL,
	"brand" "card_brand" NOT NULL,
	"last4" text NOT NULL,
	"limit_cents" bigint NOT NULL,
	"available_limit_cents" bigint NOT NULL,
	"closing_day" integer NOT NULL,
	"due_day" integer NOT NULL,
	"status" "card_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "Debt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"description" text NOT NULL,
	"total_amount_cents" bigint NOT NULL,
	"paid_amount_cents" bigint DEFAULT 0 NOT NULL,
	"remaining_amount_cents" bigint DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"type" "debt_type" NOT NULL,
	"related_person_id" text,
	"creditor_id" text,
	"notes" text,
	"status" "debt_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Installment" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"invoice_id" text,
	"number" integer NOT NULL,
	"amount_cents" bigint NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" "installment_status" DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "InstallmentPlan" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"description" text NOT NULL,
	"total_amount_cents" bigint NOT NULL,
	"installments_count" integer NOT NULL,
	"installment_value_cents" bigint NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"first_invoice_date" timestamp with time zone NOT NULL,
	"category_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"closing_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"remaining_cents" bigint DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"channels" "notification_channel"[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "NotificationPreferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"invoice_due_soon" boolean DEFAULT true NOT NULL,
	"invoice_overdue" boolean DEFAULT true NOT NULL,
	"bill_due_soon" boolean DEFAULT true NOT NULL,
	"bill_overdue" boolean DEFAULT true NOT NULL,
	"installment_due_soon" boolean DEFAULT true NOT NULL,
	"debt_due_soon" boolean DEFAULT true NOT NULL,
	"shared_debt_added" boolean DEFAULT true NOT NULL,
	"shared_debt_updated" boolean DEFAULT true NOT NULL,
	"payment_received" boolean DEFAULT true NOT NULL,
	"security_alert" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "Passkey_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "Person" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"type" "person_type" DEFAULT 'INDIVIDUAL' NOT NULL,
	"phone" text,
	"document" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RecurringBill" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"card_id" text,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"category_id" text,
	"frequency" "recurring_frequency" NOT NULL,
	"due_day" integer NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"status" "recurring_status" DEFAULT 'ACTIVE' NOT NULL,
	"next_due_date" timestamp with time zone NOT NULL,
	"date_type" date_type DEFAULT 'FIXED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"device_name" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "SharedDebt" (
	"id" text PRIMARY KEY NOT NULL,
	"debt_id" text NOT NULL,
	"debtor_user_id" text NOT NULL,
	"creditor_user_id" text NOT NULL,
	"person_id" text,
	"status" "shared_debt_status" DEFAULT 'PENDING' NOT NULL,
	"notified_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"card_id" text,
	"installment_plan_id" text,
	"invoice_id" text,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"type" "transaction_type" NOT NULL,
	"category_id" text,
	"date" timestamp with time zone NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"avatar_url" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_account_id_BankAccount_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."BankAccount"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_card_id_CreditCard_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."CreditCard"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_recurring_bill_id_RecurringBill_id_fk" FOREIGN KEY ("recurring_bill_id") REFERENCES "public"."RecurringBill"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_category_id_Category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Category" ADD CONSTRAINT "Category_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_account_id_BankAccount_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."BankAccount"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_related_person_id_Person_id_fk" FOREIGN KEY ("related_person_id") REFERENCES "public"."Person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_creditor_id_User_id_fk" FOREIGN KEY ("creditor_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_plan_id_InstallmentPlan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."InstallmentPlan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_invoice_id_Invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."Invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_card_id_CreditCard_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."CreditCard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_category_id_Category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_card_id_CreditCard_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."CreditCard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Person" ADD CONSTRAINT "Person_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_account_id_BankAccount_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."BankAccount"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_card_id_CreditCard_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."CreditCard"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_category_id_Category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebt" ADD CONSTRAINT "SharedDebt_debt_id_Debt_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."Debt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebt" ADD CONSTRAINT "SharedDebt_debtor_user_id_User_id_fk" FOREIGN KEY ("debtor_user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebt" ADD CONSTRAINT "SharedDebt_creditor_user_id_User_id_fk" FOREIGN KEY ("creditor_user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebt" ADD CONSTRAINT "SharedDebt_person_id_Person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."Person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_account_id_BankAccount_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."BankAccount"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_card_id_CreditCard_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."CreditCard"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_installment_plan_id_InstallmentPlan_id_fk" FOREIGN KEY ("installment_plan_id") REFERENCES "public"."InstallmentPlan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoice_id_Invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."Invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_category_id_Category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "AuditLog" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "AuditLog" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "AuditLog" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bank_account_user_id_idx" ON "BankAccount" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bank_account_user_id_status_idx" ON "BankAccount" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "bill_user_id_idx" ON "Bill" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bill_user_id_status_idx" ON "Bill" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "bill_due_date_idx" ON "Bill" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "bill_recurring_bill_id_idx" ON "Bill" USING btree ("recurring_bill_id");--> statement-breakpoint
CREATE INDEX "bill_card_id_idx" ON "Bill" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "category_user_id_idx" ON "Category" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "category_user_id_name_key" ON "Category" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "credit_card_user_id_idx" ON "CreditCard" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_card_user_id_status_idx" ON "CreditCard" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "credit_card_account_id_idx" ON "CreditCard" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "debt_user_id_idx" ON "Debt" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "debt_user_id_status_idx" ON "Debt" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "debt_due_date_idx" ON "Debt" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "debt_related_person_id_idx" ON "Debt" USING btree ("related_person_id");--> statement-breakpoint
CREATE INDEX "debt_creditor_id_idx" ON "Debt" USING btree ("creditor_id");--> statement-breakpoint
CREATE INDEX "installment_plan_id_idx" ON "Installment" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "installment_invoice_id_idx" ON "Installment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "installment_due_date_idx" ON "Installment" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "installment_status_idx" ON "Installment" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "installment_plan_id_number_key" ON "Installment" USING btree ("plan_id","number");--> statement-breakpoint
CREATE INDEX "installment_plan_user_id_idx" ON "InstallmentPlan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "installment_plan_card_id_idx" ON "InstallmentPlan" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "installment_plan_user_id_start_date_idx" ON "InstallmentPlan" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "invoice_card_id_idx" ON "Invoice" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "invoice_card_id_status_idx" ON "Invoice" USING btree ("card_id","status");--> statement-breakpoint
CREATE INDEX "invoice_due_date_idx" ON "Invoice" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_card_id_period_start_period_end_key" ON "Invoice" USING btree ("card_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "notification_user_id_idx" ON "Notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_user_id_read_idx" ON "Notification" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notification_created_at_idx" ON "Notification" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "Passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "person_user_id_idx" ON "Person" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "person_user_id_email_idx" ON "Person" USING btree ("user_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "person_user_id_email_key" ON "Person" USING btree ("user_id","email");--> statement-breakpoint
CREATE INDEX "recurring_bill_user_id_idx" ON "RecurringBill" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_bill_user_id_status_idx" ON "RecurringBill" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "recurring_bill_next_due_date_idx" ON "RecurringBill" USING btree ("next_due_date");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "Session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_token_hash_idx" ON "Session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "Session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "shared_debt_debt_id_idx" ON "SharedDebt" USING btree ("debt_id");--> statement-breakpoint
CREATE INDEX "shared_debt_debtor_user_id_idx" ON "SharedDebt" USING btree ("debtor_user_id");--> statement-breakpoint
CREATE INDEX "shared_debt_creditor_user_id_idx" ON "SharedDebt" USING btree ("creditor_user_id");--> statement-breakpoint
CREATE INDEX "shared_debt_person_id_idx" ON "SharedDebt" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "shared_debt_status_idx" ON "SharedDebt" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_debt_debt_id_debtor_user_id_key" ON "SharedDebt" USING btree ("debt_id","debtor_user_id");--> statement-breakpoint
CREATE INDEX "transaction_user_id_idx" ON "Transaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_user_id_date_idx" ON "Transaction" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transaction_account_id_idx" ON "Transaction" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transaction_card_id_idx" ON "Transaction" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "transaction_installment_plan_id_idx" ON "Transaction" USING btree ("installment_plan_id");--> statement-breakpoint
CREATE INDEX "transaction_invoice_id_idx" ON "Transaction" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "transaction_category_id_idx" ON "Transaction" USING btree ("category_id");