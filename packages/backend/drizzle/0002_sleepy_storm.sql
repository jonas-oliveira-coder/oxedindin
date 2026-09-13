CREATE TABLE "DebtSplit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"debt_id" text NOT NULL,
	"person_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DebtSplit" ADD CONSTRAINT "DebtSplit_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DebtSplit" ADD CONSTRAINT "DebtSplit_debt_id_Debt_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."Debt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DebtSplit" ADD CONSTRAINT "DebtSplit_person_id_Person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."Person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debt_split_debt_id_idx" ON "DebtSplit" USING btree ("debt_id");--> statement-breakpoint
CREATE INDEX "debt_split_person_id_idx" ON "DebtSplit" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "debt_split_user_id_idx" ON "DebtSplit" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debt_split_debt_id_person_id_key" ON "DebtSplit" USING btree ("debt_id","person_id");