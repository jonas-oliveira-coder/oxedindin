# Correção de Módulos Quebrados, Falhas de Validação e Erros Genéricos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os erros funcionais críticos de runtime (Select com valor vazio quebrando a tela), descompasso de centavos/moeda em pagamentos de faturas e dívidas compartilhadas, crash SQL do Drizzle com `inArray` vazio, vínculo ausente de `invoiceId` em transações de cartão, duplicação e falta de direção entre dívidas a pagar e a receber, e substituir mensagens e tratamentos de erro excessivamente genéricos por diagnósticos detalhados e precisos.

**Architecture:** Alinhar o frontend e o backend em contratos de tipos rígidos e unificados (`@oxedindin/shared` com `positiveMoneyCentsSchema` e `dateInputSchema`), eliminar falhas de renderização em componentes base (`select.tsx`) usando sentinela transparente para strings vazias, corrigir as queries do Drizzle ORM para evitar `inArray([])`, vincular corretamente as faturas geradas às transações de crédito, atribuir `creditorId` nas dívidas a receber para isolar seus fluxos e refinar o `getErrorMessage` para expor validações detalhadas campo a campo.

**Tech Stack:** Fastify (backend), Drizzle ORM (PostgreSQL), Zod, React 18, Vite, TanStack Query, Radix UI, Vitest.

**Spec:** Implementa o saneamento técnico dos módulos `invoices`, `debts`, `shared-debts`, `transactions`, `installments`, `reports` e componentes comuns de UI/formulário em `packages/frontend`, `packages/backend` e `packages/shared`.

## Global Constraints

- Todos os valores monetários persistidos ou processados em endpoints devem usar inteiros representando centavos (`cents`, `amountCents`, `positiveMoneyCentsSchema`).
- Datas podem ser enviadas como data civil (`YYYY-MM-DD`) ou timestamp ISO-8601 (`dateInputSchema`), nunca rejeitando datas civis emitidas por `<input type="date">`.
- Queries Drizzle nunca devem passar arrays vazios `[]` para `inArray()`.
- O Radix UI `<Select.Item />` nunca deve receber `value=""` diretamente no DOM.
- As mensagens de erro para o usuário devem sempre priorizar detalhes específicos dos campos validados ao invés de mensagens genéricas como "Existem dados inválidos." ou "Erro desconhecido.".

## Review Focus

1. Usuário sem cartões de crédito abre a página de Faturas ou Parcelamentos e o backend não deve falhar com erro 500 (`inArray([])`).
2. Usuário paga uma fatura de R$ 150,50 ou dívida compartilhada de R$ 50,00 e o backend deve registrar exatamente R$ 150,50 (15050 centavos) e R$ 50,00 (5000 centavos) sem erros de número float ou pagamento de centavos errados.
3. Usuário seleciona "Sem categoria" ou "Nenhuma" em qualquer formulário com `<FormSelect>` ou `<Select>` e o aplicativo não deve lançar exceção não capturada do Radix Select.
4. Usuário cria uma despesa no cartão de crédito à vista e ela deve obrigatoriamente aparecer vinculada com `invoiceId` correto na fatura correspondente.
5. Usuário cadastra uma dívida que alguém lhe deve ("Valores a receber") e ela NÃO deve aparecer duplicada na listagem de "Dívidas a pagar" e vice-versa.

---

### Task 1: Fix Radix Select Runtime Crash on `value=""` in UI Select and FormSelect

**Files:**
- Modify: `packages/frontend/src/components/ui/select.tsx`
- Modify: `packages/frontend/src/components/forms/form-select.tsx`
- Test: `packages/frontend/src/components/ui/select.test.tsx`

**Interfaces:**
- Consumes: Radix UI `@radix-ui/react-select` primitive
- Produces: `<Select>`, `<SelectItem>` e `<FormSelect>` compatíveis com `value=""` sem erros de runtime do Radix

- [ ] **Step 1: Write the failing test**

Criar `packages/frontend/src/components/ui/select.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

describe('Select with empty string value', () => {
  it('renders and selects an item with value="" without throwing Radix error', () => {
    expect(() => {
      render(
        <Select defaultValue="">
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Sem categoria</SelectItem>
            <SelectItem value="cat-1">Alimentação</SelectItem>
          </SelectContent>
        </Select>
      );
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@oxedindin/frontend -- src/components/ui/select.test.tsx`
Expected: FAIL (Radix throws "A <Select.Item /> must have a value prop that is not an empty string" ou erro de compilação do teste).

- [ ] **Step 3: Implement transparent sentinel in `select.tsx` and `form-select.tsx`**

Em `packages/frontend/src/components/ui/select.tsx`:
- Definir constante de sentinela: `export const EMPTY_SELECT_VALUE = '__OXE_EMPTY_VALUE__';`
- No componente `Select`:
  Interceptar `value`: se `value === ''`, repassar `EMPTY_SELECT_VALUE`.
  Interceptar `defaultValue`: se `defaultValue === ''`, repassar `EMPTY_SELECT_VALUE`.
  Interceptar `onValueChange`: se `val === EMPTY_SELECT_VALUE`, chamar `props.onValueChange?.('')`, senão chamar `props.onValueChange?.(val)`.
- No componente `SelectItem`:
  Interceptar `value`: se `value === ''`, repassar `EMPTY_SELECT_VALUE` para `SelectPrimitive.Item`.

Em `packages/frontend/src/components/forms/form-select.tsx`:
- Ajustar `onValueChange` para repassar `undefined` ou `''` conforme esperado pelo formulário quando a sentinela for selecionada.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@oxedindin/frontend -- src/components/ui/select.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/ui/select.tsx packages/frontend/src/components/forms/form-select.tsx packages/frontend/src/components/ui/select.test.tsx
git commit -m "fix(frontend): handle empty string values in Select and FormSelect safely"
```

---

### Task 2: Fix Drizzle `inArray` Empty-Array Crashes & Query Scopes in Invoices, Installments, and Reports

**Files:**
- Modify: `packages/backend/src/routes/invoices/index.ts`
- Modify: `packages/backend/src/routes/installments/index.ts`
- Modify: `packages/backend/src/routes/reports/index.ts`
- Create: `packages/backend/src/routes/invoices/index.test.ts`
- Modify: `packages/backend/src/routes/installments/index.test.ts`

**Interfaces:**
- Consumes: Drizzle queries nos módulos de faturas, parcelas e relatórios
- Produces: Rotas que retornam listas vazias `{ data: [], meta: ... }` em vez de executar SQL inválido com `inArray([])`

- [ ] **Step 1: Write the failing tests for empty state in invoices and installments**

Criar `packages/backend/src/routes/invoices/index.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import invoicesRoutes from './index.js';
import { buildApp } from '../../test/helpers.js';

describe('invoices routes', () => {
  let app: any;

  beforeEach(async () => {
    const harness = await buildApp(invoicesRoutes, '/api/v1/invoices');
    app = harness.app;
  });

  it('returns empty array when user has no cards without crashing on inArray', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/invoices' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
    expect(res.json().meta.total).toBe(0);
  });
});
```

Adicionar teste em `packages/backend/src/routes/installments/index.test.ts`:
```ts
it('returns empty list when user has no credit cards or plans without SQL crash', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/installments' });
  expect(res.statusCode).toBe(200);
  expect(res.json().data).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/invoices/index.test.ts src/routes/installments/index.test.ts`
Expected: FAIL com erro de execução SQL ou `inArray` vazio.

- [ ] **Step 3: Implement empty-array guards & query optimizations**

1. Em `packages/backend/src/routes/invoices/index.ts`:
   Na rota `GET /`:
   ```ts
   if (cardIds.length === 0) {
     return {
       data: [],
       meta: { total: 0, page, limit, totalPages: 0 },
     };
   }
   ```
2. Em `packages/backend/src/routes/installments/index.ts`:
   Na rota `GET /`:
   Consultar diretamente por `eq(installmentPlan.userId, userId)`. Se não houver planos (`planIds.length === 0`), retornar array vazio sem chamar `inArray(installmentPlan.cardId, cardIdArray)` nem `inArray(installment.planId, planIdArray)`.
   Na rota `GET /upcoming`:
   Se `planIdArray.length === 0`, retornar `[]` imediatamente.
3. Em `packages/backend/src/routes/reports/index.ts`:
   Na rota `GET /installments`:
   Verificar `if (cardIdArray.length === 0 || planIdArray.length === 0) return [];`
   Corrigir o filtro de data para usar `startDate ? new Date(startDate) : now`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/invoices/index.test.ts src/routes/installments/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/invoices/index.ts packages/backend/src/routes/installments/index.ts packages/backend/src/routes/reports/index.ts packages/backend/src/routes/invoices/index.test.ts packages/backend/src/routes/installments/index.test.ts
git commit -m "fix(backend): prevent crashes on inArray with empty collections in invoices and installments"
```

---

### Task 3: Fix Invoice Payment Cents Mismatch & Add Payment Integration Test

**Files:**
- Modify: `packages/frontend/src/pages/invoices/InvoicesPage.tsx`
- Modify: `packages/backend/src/routes/invoices/index.test.ts`

**Interfaces:**
- Consumes: `POST /invoices/:id/pay` com `{ amount: number (cents), accountId?: string, date?: string }`
- Produces: Pagamento de fatura exato em centavos no frontend e verificação integral no backend

- [ ] **Step 1: Write backend test for invoice payment**

Adicionar em `packages/backend/src/routes/invoices/index.test.ts`:
```ts
it('pays invoice and updates account balance and card limit', async () => {
  const cardId = '11111111-1111-4111-8111-111111111111';
  const invoiceId = '22222222-2222-4222-8222-222222222222';
  const accountId = '33333333-3333-4333-8333-333333333333';

  db.seed(creditCard, [{
    id: cardId,
    userId: TEST_USER_ID,
    name: 'Cartão Teste',
    institution: 'Banco',
    brand: 'VISA',
    last4: '1234',
    limitCents: 100000n,
    availableLimitCents: 50000n,
    closingDay: 5,
    dueDay: 15,
    status: 'ACTIVE',
  }]);

  db.seed(bankAccount, [{
    id: accountId,
    userId: TEST_USER_ID,
    name: 'Conta Corrente',
    institution: 'Banco',
    type: 'CHECKING',
    balanceCents: 100000n,
    initialBalanceCents: 100000n,
    status: 'ACTIVE',
  }]);

  db.seed(invoice, [{
    id: invoiceId,
    cardId,
    periodStart: new Date('2026-09-01'),
    periodEnd: new Date('2026-09-30'),
    closingDate: new Date('2026-09-30'),
    dueDate: new Date('2026-10-10'),
    totalCents: 50000n,
    paidCents: 0n,
    remainingCents: 50000n,
    status: 'OPEN',
  }]);

  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/invoices/${invoiceId}/pay`,
    payload: {
      amount: 50000,
      accountId,
    },
  });

  expect(res.statusCode).toBe(200);
  expect(res.json().remaining).toEqual({ cents: 0, currency: 'BRL' });
  expect(res.json().status).toBe('PAID');
});
```

- [ ] **Step 2: Run test to verify it passes on valid cents**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/invoices/index.test.ts`
Expected: PASS

- [ ] **Step 3: Fix `InvoicesPage.tsx` to handle money in cents with `CurrencyInput` and `getErrorMessage`**

Em `packages/frontend/src/pages/invoices/InvoicesPage.tsx`:
- Atualizar `paySchema`:
  ```ts
  import { positiveMoneyCentsSchema, uuidSchema } from '@oxedindin/shared';
  import { CurrencyInput, FormField } from '@/components/forms';

  const paySchema = z.object({
    amount: positiveMoneyCentsSchema,
    accountId: uuidSchema.optional().or(z.literal('')),
  });
  ```
- No modal de pagamento:
  Substituir o `<Input type="number" step="0.01" />` por `<Controller name="amount" ... render={({ field }) => <CurrencyInput ... />} />`.
  Inicializar `payForm.reset({ amount: invoice.remaining.cents, accountId: '' })`.
- No `onError` de `payMutation`, substituir `error.message` por `getErrorMessage(error)`.

- [ ] **Step 4: Run frontend tests & build**

Run: `npm run test --workspace=@oxedindin/frontend`
Run: `npm run build --workspace=@oxedindin/frontend`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pages/invoices/InvoicesPage.tsx packages/backend/src/routes/invoices/index.test.ts
git commit -m "fix(invoices): align payment amount to cents format with CurrencyInput and proper error handling"
```

---

### Task 4: Fix Shared Debts Payment Cents, Date Validation & Uniform DateInputSchema

**Files:**
- Modify: `packages/backend/src/routes/shared-debts/index.ts`
- Modify: `packages/backend/src/routes/debts/index.ts`
- Modify: `packages/backend/src/routes/bills/index.ts`
- Modify: `packages/frontend/src/pages/debts/SharedDebtsPage.tsx`
- Modify: `packages/backend/src/routes/shared-debts/index.test.ts`

**Interfaces:**
- Consumes: `dateInputSchema` em todas as rotas que recebem parâmetros ou payloads de data
- Produces: `POST /shared-debts/:id/pay`, `POST /debts/owed`, `PATCH /debts/:id`, `PATCH /bills/:id`, `POST /bills/:id/pay` aceitando tanto datas civis (`YYYY-MM-DD`) quanto ISO datetime

- [ ] **Step 1: Write test for civil date in shared debt payment**

Adicionar teste em `packages/backend/src/routes/shared-debts/index.test.ts`:
```ts
it('accepts civil date YYYY-MM-DD for shared debt payment date', async () => {
  // Configurar sharedDebt ativo e pagar com paymentDate: '2026-09-30'
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/shared-debts/${sharedDebtId}/pay`,
    payload: {
      amount: 5000,
      paymentDate: '2026-09-30',
      method: 'PIX',
    },
  });
  expect(res.statusCode).toBe(200);
});
```

- [ ] **Step 2: Run test to verify it fails on `z.string().datetime()`**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/shared-debts/index.test.ts`
Expected: FAIL com 400 Bad Request ("Invalid datetime").

- [ ] **Step 3: Replace `datetime()` with `dateInputSchema` across backend routes and fix `SharedDebtsPage.tsx`**

1. Em `packages/backend/src/routes/shared-debts/index.ts`:
   Usar `paymentDate: dateInputSchema.optional()`.
2. Em `packages/backend/src/routes/debts/index.ts`:
   Substituir `z.string().datetime()` por `dateInputSchema` em `POST /owed`, `PATCH /:id`, `POST /:id/pay`, `PATCH /owed/:id`, `POST /owed/:id/pay`.
3. Em `packages/backend/src/routes/bills/index.ts`:
   Substituir `z.string().datetime()` por `dateInputSchema` em `PATCH /:id` e `POST /:id/pay`.
4. Em `packages/frontend/src/pages/debts/SharedDebtsPage.tsx`:
   Converter o valor para centavos no envio do pagamento:
   `amount: Math.round(Number(form.amount) * 100)`
   Validar que `amount > 0` antes de submeter.

- [ ] **Step 4: Run backend and frontend tests to verify they pass**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/shared-debts/index.test.ts`
Run: `npm run test --workspace=@oxedindin/frontend`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/shared-debts/index.ts packages/backend/src/routes/debts/index.ts packages/backend/src/routes/bills/index.ts packages/frontend/src/pages/debts/SharedDebtsPage.tsx packages/backend/src/routes/shared-debts/index.test.ts
git commit -m "fix: support civil dates across routes and send cents in shared debt payments"
```

---

### Task 5: Fix Transaction Credit Card `invoiceId` Missing Link Bug

**Files:**
- Modify: `packages/backend/src/routes/transactions/index.ts`
- Modify: `packages/backend/src/routes/transactions/index.test.ts`

**Interfaces:**
- Consumes: `POST /transactions` com despesa em cartão de crédito
- Produces: Transação criada com `invoiceId: invoiceRecord.id` persistido no banco

- [ ] **Step 1: Write failing test in `transactions/index.test.ts`**

Adicionar teste em `packages/backend/src/routes/transactions/index.test.ts`:
```ts
it('links transaction to invoice when creating a credit card expense', async () => {
  const cardId = '44444444-4444-4444-8444-444444444444';
  db.seed(creditCard, [{
    id: cardId,
    userId: TEST_USER_ID,
    name: 'Cartão Crédito',
    institution: 'Banco',
    brand: 'MASTERCARD',
    last4: '4321',
    limitCents: 100000n,
    availableLimitCents: 100000n,
    closingDay: 10,
    dueDay: 20,
    status: 'ACTIVE',
  }]);

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/transactions',
    payload: {
      description: 'Compra no Crédito',
      amount: 15000,
      type: 'EXPENSE',
      paymentMethod: 'CREDIT_CARD',
      cardId,
      date: '2026-09-15',
    },
  });

  expect(res.statusCode).toBe(201);
  const rows = db.all(transaction);
  expect(rows[0].invoiceId).toBeDefined();
  expect(rows[0].invoiceId).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/transactions/index.test.ts`
Expected: FAIL com `expected undefined not to be undefined` ou `invoiceId` null.

- [ ] **Step 3: Fix `transactions/index.ts` line 474**

Em `packages/backend/src/routes/transactions/index.ts`:
Substituir:
```ts
await app.db.update(transaction)
  .set({ installmentPlanId: null })
  .where(eq(transaction.id, newTransaction.id));
```
Por:
```ts
await app.db.update(transaction)
  .set({ invoiceId: invoiceRecord.id })
  .where(eq(transaction.id, newTransaction.id));
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/transactions/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/transactions/index.ts packages/backend/src/routes/transactions/index.test.ts
git commit -m "fix(transactions): link credit card expense to generated invoiceId"
```

---

### Task 6: Fix Debt Direction Separation (Owed by User vs Owed to User) & Reports Isolation

**Files:**
- Modify: `packages/backend/src/routes/debts/index.ts`
- Modify: `packages/backend/src/routes/reports/index.ts`
- Modify: `packages/backend/src/routes/debts/index.test.ts`

**Interfaces:**
- Consumes: `POST /debts`, `POST /debts/owed`, `GET /debts`, `GET /debts/owed`, `GET /reports/debts`, `GET /reports/summary`
- Produces: Dívidas a pagar (`creditorId IS NULL` ou diferente de `userId`) isoladas de valores a receber (`creditorId = userId`)

- [ ] **Step 1: Write failing test in `debts/index.test.ts`**

Adicionar teste em `packages/backend/src/routes/debts/index.test.ts`:
```ts
it('isolates debts to pay from debts owed to user', async () => {
  const personId = '77777777-7777-4777-8777-777777777777';
  db.seed(person, [{
    id: personId,
    userId: TEST_USER_ID,
    name: 'Carlos',
    type: 'INDIVIDUAL',
    createdAt: new Date(),
    updatedAt: new Date(),
  }]);

  // 1. Dívida a pagar (eu devo para Carlos)
  await app.inject({
    method: 'POST',
    url: '/api/v1/debts',
    payload: {
      description: 'Devo a Carlos',
      totalAmount: 10000,
      dueDate: '2026-10-10',
      type: 'PERSONAL_LOAN',
      relatedPersonId: personId,
    },
  });

  // 2. Dívida a receber (Carlos me deve)
  await app.inject({
    method: 'POST',
    url: '/api/v1/debts/owed',
    payload: {
      description: 'Carlos me deve',
      totalAmount: 20000,
      dueDate: '2026-10-15',
      type: 'PERSONAL_LOAN',
      personId,
    },
  });

  const debtsRes = await app.inject({ method: 'GET', url: '/api/v1/debts' });
  const owedRes = await app.inject({ method: 'GET', url: '/api/v1/debts/owed' });

  expect(debtsRes.json().data).toHaveLength(1);
  expect(debtsRes.json().data[0].description).toBe('Devo a Carlos');

  expect(owedRes.json().data).toHaveLength(1);
  expect(owedRes.json().data[0].description).toBe('Carlos me deve');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/debts/index.test.ts`
Expected: FAIL (`debtsRes` retorna 2 dívidas ou `owedRes` retorna ambas).

- [ ] **Step 3: Implement creditorId direction separation**

1. Em `packages/backend/src/routes/debts/index.ts`:
   - No `POST /owed`: definir `creditorId: userId` ao inserir na tabela `debt`.
   - No `GET /`: filtrar com `and(eq(debt.userId, userId), isNull(debt.creditorId))` para listar estritamente dívidas a pagar do usuário.
   - No `GET /owed`: filtrar com `and(eq(debt.creditorId, userId))` para listar estritamente dívidas onde o usuário é o credor.
2. Em `packages/backend/src/routes/reports/index.ts`:
   - No `/reports/debts`:
     `toPayData`: filtrar `and(eq(debt.userId, userId), isNull(debt.creditorId))`
     `toReceiveData`: filtrar `and(eq(debt.creditorId, userId))`
   - No `/reports/summary`:
     `debtsAgg`: somar com `and(eq(debt.userId, userId), isNull(debt.creditorId))`
     `owedDebtsAgg`: somar com `and(eq(debt.creditorId, userId))`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=@oxedindin/backend -- src/routes/debts/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/debts/index.ts packages/backend/src/routes/reports/index.ts packages/backend/src/routes/debts/index.test.ts
git commit -m "fix(debts): separate debt direction with creditorId for accurate payable vs receivable accounting"
```

---

### Task 7: Enhance Error Handling to Extract Detailed Field Errors & Sync Theme State

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`
- Modify: `packages/frontend/src/pages/notifications/NotificationsPage.tsx`
- Modify: `packages/frontend/src/pages/settings/SettingsPage.tsx`
- Create: `packages/frontend/src/lib/api.test.ts`

**Interfaces:**
- Consumes: respostas com erro `{ error: { code, message, fields } }`
- Produces: `getErrorMessage(error)` retornando detalhes específicos do campo quando presentes, e `SettingsPage` aplicando tema dinamicamente no DOM e localStorage

- [x] **Step 1: Write test for detailed error messages in `api.test.ts`**

Criar `packages/frontend/src/lib/api.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './api';

describe('getErrorMessage', () => {
  it('extracts specific field validation errors over generic messages', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Existem dados inválidos.',
            fields: {
              'body.amount': 'O valor deve ser maior que zero.',
            },
          },
        },
      },
    };

    const message = getErrorMessage(error);
    expect(message).toBe('O valor deve ser maior que zero.');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@oxedindin/frontend -- src/lib/api.test.ts`
Expected: FAIL (retorna 'Existem dados inválidos.' em vez da mensagem do campo).

- [x] **Step 3: Implement enhanced error extraction & theme sync**

1. Em `packages/frontend/src/lib/api.ts`:
   Aprimorar `getErrorMessage`:
   ```ts
   export function getErrorMessage(error: unknown): string {
     if (isApiError(error)) {
       const fields = error.response?.data?.error?.fields;
       if (fields && Object.keys(fields).length > 0) {
         return Object.values(fields).join(' ');
       }
       return error.response?.data?.error?.message || 'Erro desconhecido.';
     }
     if (error instanceof Error) {
       return error.message;
     }
     return 'Erro desconhecido.';
   }
   ```
2. Em `packages/frontend/src/pages/notifications/NotificationsPage.tsx`:
   Substituir `(error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' })` por `(error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' })`.
3. Em `packages/frontend/src/pages/settings/SettingsPage.tsx`:
   No `settingsMutation.onSuccess`:
   Atualizar `localStorage.setItem('drizzle-dark-mode', (data.theme === 'dark' || (data.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)).toString())` e disparar o toggle de classe no elemento HTML para refletir a alteração instantaneamente.

- [x] **Step 4: Run tests & lint**

Run: `npm run test --workspace=@oxedindin/frontend -- src/lib/api.test.ts`
Run: `npm run test`
Run: `npm run build`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/frontend/src/lib/api.ts packages/frontend/src/pages/notifications/NotificationsPage.tsx packages/frontend/src/pages/settings/SettingsPage.tsx packages/frontend/src/lib/api.test.ts
git commit -m "fix: improve error message specificity from field validation and sync theme changes"
```
