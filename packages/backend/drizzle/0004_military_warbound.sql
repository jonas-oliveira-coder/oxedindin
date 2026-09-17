CREATE TYPE "public"."payment_status" AS ENUM('REPORTED', 'CONFIRMED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."shared_debt_event_type" AS ENUM('DEBT_SHARED', 'INVITE_SENT', 'ACCEPTED', 'REJECTED', 'PAYMENT_REPORTED', 'PAYMENT_CONFIRMED', 'PAYMENT_DISPUTED', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."shared_debt_status" ADD VALUE 'PAYMENT_REPORTED' BEFORE 'PAID';--> statement-breakpoint
ALTER TYPE "public"."shared_debt_status" ADD VALUE 'PAYMENT_CONFIRMED' BEFORE 'PAID';--> statement-breakpoint
ALTER TYPE "public"."shared_debt_status" ADD VALUE 'PAYMENT_VERIFYING' BEFORE 'PAID';--> statement-breakpoint
CREATE TABLE "PushSubscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "PushSubscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "SharedDebtEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_debt_id" text NOT NULL,
	"type" "shared_debt_event_type" NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"message" text NOT NULL,
	"amount_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SharedDebtPayment" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_debt_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"method" "payment_method",
	"notes" text,
	"reported_by_user_id" text NOT NULL,
	"confirmed_by_user_id" text,
	"status" "payment_status" DEFAULT 'REPORTED' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SharedDebt" ADD COLUMN "amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "SharedDebt" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebtEvent" ADD CONSTRAINT "SharedDebtEvent_shared_debt_id_SharedDebt_id_fk" FOREIGN KEY ("shared_debt_id") REFERENCES "public"."SharedDebt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebtEvent" ADD CONSTRAINT "SharedDebtEvent_actor_user_id_User_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebtPayment" ADD CONSTRAINT "SharedDebtPayment_shared_debt_id_SharedDebt_id_fk" FOREIGN KEY ("shared_debt_id") REFERENCES "public"."SharedDebt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebtPayment" ADD CONSTRAINT "SharedDebtPayment_reported_by_user_id_User_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SharedDebtPayment" ADD CONSTRAINT "SharedDebtPayment_confirmed_by_user_id_User_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscription_user_id_idx" ON "PushSubscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shared_debt_event_shared_debt_id_idx" ON "SharedDebtEvent" USING btree ("shared_debt_id");--> statement-breakpoint
CREATE INDEX "shared_debt_event_shared_debt_id_created_at_idx" ON "SharedDebtEvent" USING btree ("shared_debt_id","created_at");--> statement-breakpoint
CREATE INDEX "shared_debt_event_actor_user_id_idx" ON "SharedDebtEvent" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "shared_debt_payment_shared_debt_id_idx" ON "SharedDebtPayment" USING btree ("shared_debt_id");--> statement-breakpoint
CREATE INDEX "shared_debt_payment_status_idx" ON "SharedDebtPayment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shared_debt_payment_reported_by_user_id_idx" ON "SharedDebtPayment" USING btree ("reported_by_user_id");