CREATE TABLE "TransactionSplit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"person_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_transaction_id_Transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."Transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_person_id_Person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."Person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_split_transaction_id_idx" ON "TransactionSplit" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_split_person_id_idx" ON "TransactionSplit" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "transaction_split_user_id_idx" ON "TransactionSplit" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_split_transaction_id_person_id_key" ON "TransactionSplit" USING btree ("transaction_id","person_id");