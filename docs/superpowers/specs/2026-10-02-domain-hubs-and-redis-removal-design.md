# Especificação de Design: Hubs de Domínio e Remoção do Redis

**Data**: 2026-10-02  
**Status**: Em Revisão / Aprovado para Implementação  
**Autor**: Jonas Oliveira / Pair Programming Assistant  

---

## 1. Contexto e Motivação

O **OxeDinDin** possui um conjunto robusto de funcionalidades financeiras e de segurança, porém identificou-se que:
1. **Sobrecarga e Fragmentação de Menus**: A aplicação contava com 15 itens na barra lateral, gerando separação artificial entre telas intimamente ligadas (ex: Cartões, Faturas e Parcelamentos; Dívidas, Dívidas Compartilhadas e Pessoas; Configurações, Segurança e Categorias).
2. **Ambiguidade de Nomenclatura**: "Contas" (bancárias) e "Contas a Pagar" (despesas/boletos) lado a lado causavam confusão de contexto.
3. **Complexidade Desnecessária de Infraestrutura (Redis)**: O Redis era utilizado unicamente para armazenar desafios temporários de 5 minutos do WebAuthn/Passkey — funcionalidade que já contava com fallback em memória no código e cujas sessões persistentes reais sempre residiram no PostgreSQL. O Redis adicionava consumo desnecessário de RAM na VM Oracle Cloud Always Free (1 GB RAM) e um ponto extra de falha no Coolify.

---

## 2. Decisões Arquiteturais

### 2.1. Consolidação de Menus em Hubs por Domínio (Frontend)

A estrutura de navegação passa de 15 itens para **6 seções principais no menu**:

```
[ Menu Principal ]
1. Dashboard              -> /dashboard
2. Transações             -> /transactions
3. Contas & Cartões       -> /accounts (com abas: Contas Bancárias, Cartões de Crédito, Faturas, Parcelamentos)
4. Contas a Pagar         -> /bills (com abas: Contas Avulsas, Recorrentes & Fixas)
5. Dívidas & Contatos     -> /debts (com abas: Minhas Dívidas, Dívidas Compartilhadas, Pessoas/Contatos)
6. Relatórios             -> /reports
7. Configurações          -> /settings (com abas: Perfil & Preferências, Segurança & Sessões, Categorias, Notificações)
```

#### Preservação e Retrocompatibilidade de Rotas:
Para evitar quebra de favoritos ou links internos:
- Rotas antigas como `/cards`, `/invoices`, `/installments` redirecionam suavemente para `/accounts?tab=cards`, `/accounts?tab=invoices`, `/accounts?tab=installments` (ou renderizam o hub com a aba ativa).
- Rotas antigas como `/shared-debts` e `/people` redirecionam para `/debts?tab=shared` e `/debts?tab=people`.
- Rotas antigas como `/security`, `/categories` e `/notifications` redirecionam para `/settings?tab=security`, `/settings?tab=categories` e `/settings?tab=notifications`.

#### Mobile Bottom Bar:
Reduzida para os 4 acessos mais frequentes + botão "Mais":
- **Dashboard**
- **Transações**
- **Contas & Cartões**
- **Dívidas**
- **Mais** (abre o drawer contendo Relatórios e Configurações)

---

### 2.2. Remoção do Subsistema Redis (Backend e Infraestrutura)

1. **Gestão de Desafios WebAuthn (Passkeys)**:
   - Substituição do Redis por um repositório em memória no `AuthService` com varredura e expiração ativa (`setInterval` a cada 5 minutos) para eliminar chaves com mais de 300 segundos, sem acúmulo de memória.
2. **Health Check (`/health`)**:
   - Valida exclusivamente a conexão com o PostgreSQL (`SELECT 1`).
   - Remove o status `services.redis`.
3. **Limpeza de Dependências**:
   - Remoção de `ioredis` do `packages/backend/package.json`.
   - Remoção do plugin `packages/backend/src/plugins/redis.ts`.
   - Remoção da variável de ambiente `REDIS_URL` dos schemas de validação (`env.ts`).
4. **Simplificação do Docker e Coolify**:
   - `docker-compose.yml`: Remoção do container `redis`, volume `redis_data` e referências `depends_on: redis`.
   - `docker-compose.production.example.yml`: Remoção do container `redis` e volume `redis_prod_data`. A stack de produção passa a exigir apenas PostgreSQL + Aplicação OxeDinDin.
   - `.env.example`: Remoção de `REDIS_URL`.

---

## 3. Detalhamento dos Componentes

### 3.1. Hub de Contas & Cartões (`/accounts`)
Componente unificado que organiza o patrimônio e os meios de pagamento em abas (`Tabs` do Radix UI):
- **Aba 1: Contas Bancárias**: Listagem, criação, edição e exclusão de contas correntes, poupanças e digitais, com saldo em tempo real.
- **Aba 2: Cartões de Crédito**: Exibição dos cartões com limites e vencimentos, barra de progresso de limite, cadastro e edição.
- **Aba 3: Faturas**: Visualização de faturas abertas, fechadas, vencidas e pagas, com ação de liquidação via débito em conta.
- **Aba 4: Compras Parceladas**: Listagem de compras a prazo (em até 60x), baixa de parcelas individuais e cancelamento de planos.

### 3.2. Hub de Dívidas & Contatos (`/debts`)
Componente unificado para todas as pendências financeiras interpessoais:
- **Aba 1: Minhas Dívidas**: Dívidas a pagar (obrigações) e valores a receber (créditos), amortizações e rateio.
- **Aba 2: Dívidas Compartilhadas**: Fluxo bilateral completo (convite, aceite, aviso de pagamento pelo devedor, confirmação pelo credor, contestação e histórico auditável).
- **Aba 3: Pessoas & Contatos**: Cadastro de pessoas físicas e jurídicas com atalho de vínculo financeiro direto e botão "Vincular a Dívida".

### 3.3. Hub de Configurações (`/settings`)
Componente que agrupa a parametrização do sistema e governança da conta:
- **Aba 1: Perfil & Preferências**: Nome, upload e remoção de avatar (JPG/PNG/WebP até 2MB), tema claro/escuro, idioma, moeda, primeiro dia da semana e atalho PWA.
- **Aba 2: Segurança & Sessões**: Alteração de senha, gerador de senhas seguras, registro e revogação de Passkeys/biometria, encerramento remoto de sessões ativas e log de auditoria.
- **Aba 3: Categorias**: Visualização, criação, edição e exclusão de categorias personalizadas (com código HEX de cor e ícones) e inicialização de categorias padrão.
- **Aba 4: Notificações**: Regras granulares de alerta (10 gatilhos financeiros) e canais de entrega (In-app, E-mail, Web Push).

---

## 4. Segurança e Integridade dos Dados

1. **Sessões e Autenticação**: Permanecem 100% protegidas no PostgreSQL com hash de token Argon2id, expiração forçada e revogação em cascata.
2. **Proteção contra DoS / Memória no WebAuthn**: O store em memória possui limite máximo de registros e auto-limpeza a cada 5 minutos, garantindo que mesmo um ataque com milhares de desafios não cause esgotamento de memória.
3. **CORS, Helmet e CSP**: Permanecem configurados estritamente no backend.

---

## 5. Plano de Testes e Validação

1. **Testes Unitários e de Integração do Backend**:
   - Ajustar testes de auth, health check e schemas para não exigir mais Redis.
   - Executar suíte completa de testes (`npm test` no workspace `@oxedindin/backend`).
2. **Testes do Frontend**:
   - Atualizar testes de rotas, layouts e componentes para o novo esquema de abas e redirecionamentos.
   - Executar `npm test` no workspace `@oxedindin/frontend`.
3. **Build Completo**:
   - `npm run build` gerando os pacotes `@oxedindin/shared`, `@oxedindin/backend` e `@oxedindin/frontend`.
4. **Verificação de Docker Compose**:
   - Validar sintaxe dos arquivos `docker-compose.yml` e `docker-compose.production.example.yml`.
