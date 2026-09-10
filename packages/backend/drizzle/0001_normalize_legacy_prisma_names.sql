DO $$
DECLARE
  item text[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ['AccountStatus', 'account_status'],
    ['AccountType', 'account_type'],
    ['BillStatus', 'bill_status'],
    ['CardBrand', 'card_brand'],
    ['CardStatus', 'card_status'],
    ['DateType', 'date_type'],
    ['DebtStatus', 'debt_status'],
    ['DebtType', 'debt_type'],
    ['InstallmentStatus', 'installment_status'],
    ['InvoiceStatus', 'invoice_status'],
    ['NotificationChannel', 'notification_channel'],
    ['NotificationType', 'notification_type'],
    ['PaymentMethod', 'payment_method'],
    ['PersonType', 'person_type'],
    ['RecurringFrequency', 'recurring_frequency'],
    ['RecurringStatus', 'recurring_status'],
    ['SharedDebtStatus', 'shared_debt_status'],
    ['TransactionType', 'transaction_type']
  ] LOOP
    IF to_regtype(format('public.%I', item[1])) IS NOT NULL
       AND to_regtype(format('public.%I', item[2])) IS NULL THEN
      EXECUTE format('ALTER TYPE %I RENAME TO %I', item[1], item[2]);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  item text[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ['AuditLog', 'userId', 'user_id'], ['AuditLog', 'entityType', 'entity_type'],
    ['AuditLog', 'entityId', 'entity_id'], ['AuditLog', 'oldData', 'old_data'],
    ['AuditLog', 'newData', 'new_data'], ['AuditLog', 'userAgent', 'user_agent'],
    ['AuditLog', 'createdAt', 'created_at'],
    ['BankAccount', 'userId', 'user_id'], ['BankAccount', 'balanceCents', 'balance_cents'],
    ['BankAccount', 'initialBalanceCents', 'initial_balance_cents'],
    ['BankAccount', 'createdAt', 'created_at'], ['BankAccount', 'updatedAt', 'updated_at'],
    ['Bill', 'userId', 'user_id'], ['Bill', 'accountId', 'account_id'],
    ['Bill', 'cardId', 'card_id'], ['Bill', 'recurringBillId', 'recurring_bill_id'],
    ['Bill', 'amountCents', 'amount_cents'], ['Bill', 'categoryId', 'category_id'],
    ['Bill', 'dueDate', 'due_date'], ['Bill', 'paymentMethod', 'payment_method'],
    ['Bill', 'paidAt', 'paid_at'], ['Bill', 'createdAt', 'created_at'],
    ['Bill', 'updatedAt', 'updated_at'],
    ['Category', 'userId', 'user_id'], ['Category', 'isDefault', 'is_default'],
    ['Category', 'createdAt', 'created_at'], ['Category', 'updatedAt', 'updated_at'],
    ['CreditCard', 'userId', 'user_id'], ['CreditCard', 'accountId', 'account_id'],
    ['CreditCard', 'last4', 'last4'], ['CreditCard', 'limitCents', 'limit_cents'],
    ['CreditCard', 'availableLimitCents', 'available_limit_cents'],
    ['CreditCard', 'closingDay', 'closing_day'], ['CreditCard', 'dueDay', 'due_day'],
    ['CreditCard', 'createdAt', 'created_at'], ['CreditCard', 'updatedAt', 'updated_at'],
    ['Debt', 'userId', 'user_id'], ['Debt', 'totalAmountCents', 'total_amount_cents'],
    ['Debt', 'paidAmountCents', 'paid_amount_cents'],
    ['Debt', 'remainingAmountCents', 'remaining_amount_cents'],
    ['Debt', 'dueDate', 'due_date'], ['Debt', 'relatedPersonId', 'related_person_id'],
    ['Debt', 'creditorId', 'creditor_id'], ['Debt', 'createdAt', 'created_at'],
    ['Debt', 'updatedAt', 'updated_at'],
    ['Installment', 'planId', 'plan_id'], ['Installment', 'invoiceId', 'invoice_id'],
    ['Installment', 'amountCents', 'amount_cents'], ['Installment', 'dueDate', 'due_date'],
    ['Installment', 'paidAt', 'paid_at'], ['Installment', 'createdAt', 'created_at'],
    ['Installment', 'updatedAt', 'updated_at'],
    ['InstallmentPlan', 'userId', 'user_id'], ['InstallmentPlan', 'cardId', 'card_id'],
    ['InstallmentPlan', 'totalAmountCents', 'total_amount_cents'],
    ['InstallmentPlan', 'installmentsCount', 'installments_count'],
    ['InstallmentPlan', 'installmentValueCents', 'installment_value_cents'],
    ['InstallmentPlan', 'startDate', 'start_date'], ['InstallmentPlan', 'firstInvoiceDate', 'first_invoice_date'],
    ['InstallmentPlan', 'categoryId', 'category_id'], ['InstallmentPlan', 'createdAt', 'created_at'],
    ['InstallmentPlan', 'updatedAt', 'updated_at'],
    ['Invoice', 'cardId', 'card_id'], ['Invoice', 'periodStart', 'period_start'],
    ['Invoice', 'periodEnd', 'period_end'], ['Invoice', 'closingDate', 'closing_date'],
    ['Invoice', 'dueDate', 'due_date'], ['Invoice', 'totalCents', 'total_cents'],
    ['Invoice', 'paidCents', 'paid_cents'], ['Invoice', 'remainingCents', 'remaining_cents'],
    ['Invoice', 'createdAt', 'created_at'], ['Invoice', 'updatedAt', 'updated_at'],
    ['Notification', 'userId', 'user_id'], ['Notification', 'relatedEntityType', 'related_entity_type'],
    ['Notification', 'relatedEntityId', 'related_entity_id'], ['Notification', 'createdAt', 'created_at'],
    ['NotificationPreferences', 'userId', 'user_id'], ['NotificationPreferences', 'invoiceDueSoon', 'invoice_due_soon'],
    ['NotificationPreferences', 'invoiceOverdue', 'invoice_overdue'], ['NotificationPreferences', 'billDueSoon', 'bill_due_soon'],
    ['NotificationPreferences', 'billOverdue', 'bill_overdue'], ['NotificationPreferences', 'installmentDueSoon', 'installment_due_soon'],
    ['NotificationPreferences', 'debtDueSoon', 'debt_due_soon'], ['NotificationPreferences', 'sharedDebtAdded', 'shared_debt_added'],
    ['NotificationPreferences', 'sharedDebtUpdated', 'shared_debt_updated'], ['NotificationPreferences', 'paymentReceived', 'payment_received'],
    ['NotificationPreferences', 'securityAlert', 'security_alert'], ['NotificationPreferences', 'emailEnabled', 'email_enabled'],
    ['NotificationPreferences', 'pushEnabled', 'push_enabled'], ['NotificationPreferences', 'inAppEnabled', 'in_app_enabled'],
    ['NotificationPreferences', 'updatedAt', 'updated_at'],
    ['Passkey', 'userId', 'user_id'], ['Passkey', 'credentialId', 'credential_id'],
    ['Passkey', 'publicKey', 'public_key'], ['Passkey', 'createdAt', 'created_at'],
    ['Passkey', 'lastUsedAt', 'last_used_at'],
    ['Person', 'userId', 'user_id'], ['Person', 'createdAt', 'created_at'], ['Person', 'updatedAt', 'updated_at'],
    ['RecurringBill', 'userId', 'user_id'], ['RecurringBill', 'accountId', 'account_id'],
    ['RecurringBill', 'cardId', 'card_id'], ['RecurringBill', 'amountCents', 'amount_cents'],
    ['RecurringBill', 'categoryId', 'category_id'], ['RecurringBill', 'dueDay', 'due_day'],
    ['RecurringBill', 'startDate', 'start_date'], ['RecurringBill', 'endDate', 'end_date'],
    ['RecurringBill', 'nextDueDate', 'next_due_date'], ['RecurringBill', 'dateType', 'date_type'],
    ['RecurringBill', 'createdAt', 'created_at'], ['RecurringBill', 'updatedAt', 'updated_at'],
    ['SharedDebt', 'debtId', 'debt_id'], ['SharedDebt', 'debtorUserId', 'debtor_user_id'],
    ['SharedDebt', 'creditorUserId', 'creditor_user_id'], ['SharedDebt', 'personId', 'person_id'],
    ['SharedDebt', 'notifiedAt', 'notified_at'], ['SharedDebt', 'acceptedAt', 'accepted_at'],
    ['SharedDebt', 'createdAt', 'created_at'], ['SharedDebt', 'updatedAt', 'updated_at'],
    ['Transaction', 'userId', 'user_id'], ['Transaction', 'accountId', 'account_id'],
    ['Transaction', 'cardId', 'card_id'], ['Transaction', 'installmentPlanId', 'installment_plan_id'],
    ['Transaction', 'invoiceId', 'invoice_id'], ['Transaction', 'amountCents', 'amount_cents'],
    ['Transaction', 'categoryId', 'category_id'], ['Transaction', 'paymentMethod', 'payment_method'],
    ['Transaction', 'createdAt', 'created_at'], ['Transaction', 'updatedAt', 'updated_at']
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = item[1] AND column_name = item[2]
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = item[1] AND column_name = item[3]
    ) THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', item[1], item[2], item[3]);
    END IF;
  END LOOP;
END $$;