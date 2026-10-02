# Implementação: Hubs de Domínio e Remoção do Redis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar os 15 menus do frontend em 6 hubs coesos com abas por domínio de negócio, eliminar o Redis do backend e da infraestrutura Docker/Coolify em favor de uma gestão leve em memória, e manter 100% de retrocompatibilidade de rotas e segurança.

**Architecture:** O frontend passa a utilizar hubs por domínio baseados em tabs do Radix UI com sincronização via query string (`?tab=...`) para que rotas legadas continuem funcionando perfeitamente via redirecionamento. No backend, o Redis é removido e os desafios temporários de WebAuthn/Passkey passam a ser geridos em memória com descarte automático de TTL. Os arquivos do Docker Compose e o template de produção do Coolify são simplificados para rodar apenas PostgreSQL e a aplicação.

**Tech Stack:** React 18, React Router v6, Radix UI Tabs, Tailwind CSS, Fastify, TypeScript, PostgreSQL, Drizzle ORM, Docker Compose, Coolify.

**Spec:** `docs/superpowers/specs/2026-10-02-domain-hubs-and-redis-removal-design.md`

## Global Constraints

- Todas as rotas anteriores (`/cards`, `/invoices`, `/installments`, `/shared-debts`, `/people`, `/security`, `/categories`, `/notifications`) devem continuar navegáveis, redirecionando para a aba correspondente do seu respectivo Hub.
- Todos os 200+ testes unitários e de integração existentes devem continuar passando ou ser atualizados para refletir a nova estrutura.
- Nenhuma dependência externa ao Node.js / PostgreSQL deve ser necessária para rodar o backend localmente ou em produção.
- O build de produção do frontend (Vite + PWA) e backend (`tsc`) deve finalizar com código de saída 0.

## Review Focus

1. *Acesso direto via URL profunda (ex: `/accounts?tab=invoices` ou `/debts?tab=shared`)*: o componente deve abrir diretamente na aba solicitada na query string.
2. *Redirecionamento de links legados (ex: clicar em `/invoices` no dashboard)*: deve conduzir sem erro 404 para `/accounts?tab=invoices`.
3. *Health check `/health` sem Redis*: deve responder status `ok` com conectividade ao banco de dados sem tentar se conectar ao Redis.
4. *Autenticação Passkey sem Redis*: registro e login via WebAuthn devem continuar funcionando com desafios gerados e validados no `AuthService`.
5. *Consumo e integridade do Coolify*: template `docker-compose.production.example.yml` não deve conter serviços ou volumes do Redis.

---

### Task 1: Backend - Remoção do Redis e Store de Desafios em Memória

**Files:**
- Modify: `packages/backend/src/services/auth.service.ts`
- Modify: `packages/backend/src/plugins/redis.ts`
- Modify: `packages/backend/src/routes/health/index.ts`
- Modify: `packages/backend/src/main.ts`
- Modify: `packages/backend/src/utils/env.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/backend/src/routes/health/index.test.ts`
- Test: `packages/backend/src/services/auth.service.test.ts`

**Interfaces:**
- Produces: `AuthService.setChallenge(challenge, type, userId)` e `AuthService.getAndClearChallenge(id)` sem chamadas a `app.redis`.
- Produces: `/health` retornando `{ status: 'ok', timestamp: string, services: { database: 'ok' | 'down' } }`.

- [ ] **Step 1: Atualizar teste de Health Check para remover expectativa de Redis**
No arquivo `packages/backend/src/routes/health/index.test.ts`, ajustar as asserções para validar `services: { database: 'ok' }`.

- [ ] **Step 2: Rodar teste para verificar a falha/mudança**
Comando: `export PATH="/home/jonas/.local/bin:$PATH" && npx vitest run packages/backend/src/routes/health/index.test.ts`

- [ ] **Step 3: Implementar a remoção do Redis no Backend**
  - Em `packages/backend/src/services/auth.service.ts`: remover blocos `if (this.app.redis)` e utilizar a coleção em memória `challenges` com `setInterval` de 5 minutos para limpar entradas expiradas (`expiresAt < Date.now()`).
  - Em `packages/backend/src/routes/health/index.ts`: verificar apenas `app.db.execute(sql\`SELECT 1\`)` e retornar status `database`.
  - Em `packages/backend/src/plugins/redis.ts`: remover ou desativar o registro de `app.redis`.
  - Em `packages/backend/src/main.ts`: remover import e registro do plugin redis.
  - Em `packages/backend/src/utils/env.ts`: tornar `REDIS_URL` opcional ou removê-la dos schemas obrigatórios.
  - Em `packages/shared/src/index.ts`: atualizar schema/tipo de `HealthResponse` para remover `redis`.

- [ ] **Step 4: Executar testes de auth e health para garantir aprovação**
Comando: `export PATH="/home/jonas/.local/bin:$PATH" && npx vitest run packages/backend/src/routes/health/index.test.ts packages/backend/src/services/auth.service.test.ts`

- [ ] **Step 5: Commit**
```bash
git add packages/backend/ packages/shared/
git commit -m "refactor(backend): remover dependencia do redis e migrar desafios passkey para memoria"
```

---

### Task 2: Infraestrutura - Simplificação do Docker Compose e Coolify

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.production.example.yml`
- Modify: `.env.example`
- Modify: `packages/backend/package.json`

**Interfaces:**
- Produces: `docker-compose.yml` e `docker-compose.production.example.yml` funcionais contendo apenas `postgres` e serviços da aplicação.

- [ ] **Step 1: Remover o serviço Redis do Docker Compose local**
Editar `docker-compose.yml` removendo o serviço `redis:`, o volume `redis_data:` e `depends_on: redis`.

- [ ] **Step 2: Remover o serviço Redis do template de produção do Coolify**
Editar `docker-compose.production.example.yml` removendo o serviço `redis:`, o volume `redis_prod_data:` e referências a `REDIS_URL`.

- [ ] **Step 3: Atualizar `.env.example` e dependências do Backend**
Remover `REDIS_URL` de `.env.example`. Em `packages/backend/package.json`, desinstalar ou remover `ioredis`.

- [ ] **Step 4: Validar sintaxe dos arquivos do compose**
Comando: `docker compose config`

- [ ] **Step 5: Commit**
```bash
git add docker-compose.yml docker-compose.production.example.yml .env.example packages/backend/package.json
git commit -m "chore(infra): remover redis do docker compose e do template do coolify"
```

---

### Task 3: Frontend - Hub de Contas & Cartões (`/accounts`)

**Files:**
- Modify: `packages/frontend/src/pages/accounts/AccountsPage.tsx`
- Modify: `packages/frontend/src/App.tsx`
- Test: `packages/frontend/src/pages/accounts/AccountsPage.test.tsx` (ou testes de integração de contas)

**Interfaces:**
- Consumes: Componentes e formulários de Contas, Cartões, Faturas e Parcelamentos.
- Produces: Hub unificado com abas `accounts`, `cards`, `invoices`, `installments`.

- [ ] **Step 1: Escrever teste de renderização do Hub com abas**
Criar/atualizar teste verificando a alternância entre a aba de contas e a aba de cartões via `Tabs`.

- [ ] **Step 2: Executar teste para verificar comportamento**
Comando: `export PATH="/home/jonas/.local/bin:$PATH" && npx vitest run packages/frontend/`

- [ ] **Step 3: Implementar o Hub unificado em `AccountsPage.tsx`**
  - Integrar os componentes de `AccountsPage`, `CardsPage`, `InvoicesPage` e `InstallmentsPage` sob um componente mestre `AccountsAndCardsHub` (ou `AccountsPage` com abas).
  - Suportar `useSearchParams` (`const [searchParams, setSearchParams] = useSearchParams(); const tab = searchParams.get('tab') || 'accounts';`).
  - Abas:
    - `accounts`: Contas bancárias e saldos.
    - `cards`: Cartões de crédito e limites.
    - `invoices`: Faturas abertas, fechadas e pagamento.
    - `installments`: Compras parceladas e status de prestações.
  - Atualizar `App.tsx` com redirects:
    - `/cards` -> `/accounts?tab=cards`
    - `/invoices` -> `/accounts?tab=invoices`
    - `/installments` -> `/accounts?tab=installments`

- [ ] **Step 4: Verificar funcionamento dos testes**
Comando: `export PATH="/home/jonas/.local/bin:$PATH" && npx vitest run packages/frontend/`

- [ ] **Step 5: Commit**
```bash
git add packages/frontend/src/pages/accounts/ packages/frontend/src/App.tsx
git commit -m "feat(frontend): unificar contas, cartoes, faturas e parcelamentos no hub accounts"
```

---

### Task 4: Frontend - Hub de Dívidas & Contatos (`/debts`)

**Files:**
- Modify: `packages/frontend/src/pages/debts/DebtsPage.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Interfaces:**
- Consumes: Módulos de dívidas pessoais, compartilhadas e contatos.
- Produces: Hub unificado em `/debts` com abas `debts`, `shared`, `people`.

- [ ] **Step 1: Implementar abas de Dívidas Pessoais, Compartilhadas e Contatos**
  - Em `DebtsPage.tsx`:
    - Adicionar suporte a abas de nível superior:
      - Aba `personal`: Dívidas a Pagar e Valores a Receber.
      - Aba `shared`: Dívidas Compartilhadas (incorporando o conteúdo do `SharedDebtsPage`).
      - Aba `people`: Pessoas & Contatos (incorporando o conteúdo do `PeoplePage`).
    - Sincronizar aba ativa com `useSearchParams` (`?tab=shared`, `?tab=people`, `?tab=personal`).
  - Em `App.tsx`:
    - `/shared-debts` redireciona para `/debts?tab=shared`.
    - `/people` redireciona para `/debts?tab=people`.

- [ ] **Step 2: Verificar testes do frontend**
Comando: `export PATH="/home/jonas/.local/bin:$PATH" && npx vitest run packages/frontend/`

- [ ] **Step 3: Commit**
```bash
git add packages/frontend/src/pages/debts/ packages/frontend/src/App.tsx
git commit -m "feat(frontend): unificar dividas pessoais, compartilhadas e contatos no hub debts"
```

---

### Task 5: Frontend - Hub de Configurações (`/settings`)

**Files:**
- Modify: `packages/frontend/src/pages/settings/SettingsPage.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Interfaces:**
- Consumes: Preferências, Segurança, Categorias e Notificações.
- Produces: Hub unificado em `/settings` com abas `profile`, `security`, `categories`, `notifications`.

- [ ] **Step 1: Implementar abas em `SettingsPage.tsx`**
  - Aba `profile`: Perfil do usuário, foto/avatar, moeda, idioma, tema, PWA.
  - Aba `security`: Troca de senha, gerador de senhas, passkeys/biometria, dispositivos ativos, audit log (incorporando `SecurityPage`).
  - Aba `categories`: Gestão de categorias de transações (incorporando `CategoriesPage`).
  - Aba `notifications`: Preferências e canais de notificação (incorporando `NotificationsPage`).
  - Sincronização via `useSearchParams` (`?tab=security`, etc.).
  - Em `App.tsx`:
    - `/security` redireciona para `/settings?tab=security`.
    - `/categories` redireciona para `/settings?tab=categories`.
    - `/notifications` redireciona para `/settings?tab=notifications`.

- [ ] **Step 2: Testar execução do frontend**
Comando: `export PATH="/home/jonas/.local/bin:$PATH" && npx vitest run packages/frontend/`

- [ ] **Step 3: Commit**
```bash
git add packages/frontend/src/pages/settings/ packages/frontend/src/App.tsx
git commit -m "feat(frontend): consolidar perfil, seguranca, categorias e notificacoes no hub settings"
```

---

### Task 6: Frontend - Reestruturação da Barra Lateral e Navegação Mobile (`layout.tsx`)

**Files:**
- Modify: `packages/frontend/src/components/shared/layout.tsx`

**Interfaces:**
- Produces: Array `navigation` enxuto com os 6 menus fundamentais:
  1. `Dashboard` (`/dashboard`, icon: `LayoutDashboard`)
  2. `Transações` (`/transactions`, icon: `Receipt`)
  3. `Contas & Cartões` (`/accounts`, icon: `CreditCard` ou `Wallet`)
  4. `Contas a Pagar` (`/bills`, icon: `DollarSign`)
  5. `Dívidas & Contatos` (`/debts`, icon: `Users`)
  6. `Relatórios` (`/reports`, icon: `BarChart3`)
  7. `Configurações` (`/settings`, icon: `Settings`)
- Produces: `MAIN_TABS` mobile otimizado: Dashboard, Transações, Contas & Cartões, Dívidas, Mais.

- [ ] **Step 1: Atualizar lista de navegação em `layout.tsx`**
Substituir a lista extensa de 15 itens pelos 6 domínios centrais + Configurações.

- [ ] **Step 2: Atualizar mobile tabs**
Ajustar `MAIN_TABS` para os 4 atalhos principais + "Mais".

- [ ] **Step 3: Executar testes de interface**
Comando: `export PATH="/home/jonas/.local/bin:$PATH" && npx vitest run packages/frontend/`

- [ ] **Step 4: Commit**
```bash
git add packages/frontend/src/components/shared/layout.tsx
git commit -m "refactor(frontend): simplificar menu lateral e barra de navegacao mobile"
```

---

### Task 7: Atualização de Documentação e Verificação Geral

**Files:**
- Modify: `FUNCIONALIDADES.md`
- Modify: `README.md`

- [ ] **Step 1: Atualizar `FUNCIONALIDADES.md`**
Refletir os novos 6 hubs consolidados com abas, explicar o descarte do Redis e documentar as rotas canônicas.

- [ ] **Step 2: Atualizar `README.md`**
Remover o Redis da tabela de tecnologias, pré-requisitos e fluxos de inicialização.

- [ ] **Step 3: Executar build e testes completos de todos os workspaces**
Comando: `export PATH="/home/jonas/.local/bin:$PATH" && npm run build && npm test`
Verificar: Código de saída 0 e 200+ testes aprovados.

- [ ] **Step 4: Commit final**
```bash
git add FUNCIONALIDADES.md README.md
git commit -m "docs: atualizar manual de funcionalidades e readme com nova arquitetura de hubs e sem redis"
```
