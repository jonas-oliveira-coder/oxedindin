# OxeDinDin - Gerenciador Financeiro Pessoal

Uma plataforma completa de gerenciamento de finanças pessoais, construída com foco em segurança, privacidade e experiência do usuário.

## 🚀 Tecnologias

### Backend

- **Fastify** - Framework web rápido e de baixa sobrecarga
- **Prisma ORM** - ORM type-safe para PostgreSQL
- **PostgreSQL** - Banco de dados relacional robusto
- **Redis** - Cache e filas (BullMQ)
- **JWT + Passkeys (WebAuthn)** - Autenticação moderna e segura
- **Argon2id** - Hash de senhas seguro
- **Zod** - Validação de schemas
- **TypeScript** - Tipagem estática

### Frontend

- **React 18** - Biblioteca de UI
- **Vite** - Build tool ultrarrápido
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS utility-first
- **Radix UI** - Componentes acessíveis e não estilizados
- **TanStack Query** - Gerenciamento de estado do servidor
- **React Hook Form + Zod** - Formulários e validação
- **Recharts** - Gráficos e visualizações
- **Zustand** - Gerenciamento de estado global

### Infraestrutura

- **Docker** - Containerização multi-stage
- **GitHub Actions** - CI/CD
- **GHCR** - Registry de containers
- **Coolify** - Deploy e gerenciamento
- **pnpm Workspaces** - Monorepo

## 📁 Estrutura do Projeto

```
oxedindin/
├── .github/workflows/     # CI/CD pipelines
├── packages/
│   ├── shared/            # Tipos e utilitários compartilhados
│   ├── backend/           # API Fastify
│   │   ├── prisma/        # Schema do banco de dados
│   │   └── src/           # Código fonte do backend
│   └── frontend/          # SPA React + Vite
│       └── src/           # Código fonte do frontend
├── docker-compose.yml     # Desenvolvimento local
├── Dockerfile             # Build multi-stage para produção
└── pnpm-workspace.yaml    # Configuração do monorepo
```

## 🛠️ Desenvolvimento Local

### Pré-requisitos

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 16+ (ou use o docker-compose)
- Redis 7+ (ou use o docker-compose)

### Iniciando

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/oxedindin.git
cd oxedindin

# Copie as variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# Inicie os serviços (PostgreSQL + Redis)
docker compose up -d postgres redis

# Instale dependências
pnpm install

# Gere o Prisma Client
pnpm db:generate

# Execute as migrações
pnpm db:migrate

# Inicie em modo desenvolvimento
pnpm dev
```

A aplicação estará disponível em:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Documentação da API: http://localhost:3000/docs

## 📦 Scripts Disponíveis

```bash
# Desenvolvimento
pnpm dev              # Inicia frontend e backend
pnpm dev:backend      # Apenas backend
pnpm dev:frontend     # Apenas frontend

# Build
pnpm build            # Build de todos os pacotes
pnpm build:backend    # Build do backend
pnpm build:frontend   # Build do frontend

# Banco de dados
pnpm db:generate      # Gera Prisma Client
pnpm db:push          # Push schema para DB (dev)
pnpm db:migrate       # Executa migrações
pnpm db:migrate:deploy # Deploy migrações (prod)
pnpm db:studio        # Abre Prisma Studio
pnpm db:seed          # Popula dados de exemplo

# Testes
pnpm test             # Testes unitários
pnpm test:e2e         # Testes E2E (frontend)

# Docker
pnpm docker:build     # Build da imagem Docker
pnpm docker:run       # Executa container localmente
```

## 🏗️ Deploy em Produção

### Coolify + GHCR

1. Configure os secrets no GitHub:

   - `COOLIFY_WEBHOOK_URL` - Webhook do Coolify
   - `COOLIFY_TOKEN` - Token de autenticação (se necessário)
2. No Coolify, crie um recurso **Docker Image**:

   ```
   ghcr.io/seu-usuario/oxedindin:latest
   ```
3. Configure as variáveis de ambiente no Coolify:

   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `COOKIE_SECRET`
   - `WEB_AUTHN_RP_ID`
   - `WEB_AUTHN_RP_NAME`
   - `WEB_AUTHN_ORIGIN`
   - `CORS_ORIGIN`
   - `FRONTEND_URL`
4. O deploy é automático no push para `main`/`master`.

## 🔐 Segurança

- **Autenticação**: JWT (access token 15min + refresh token 7d) + Passkeys/WebAuthn
- **Senhas**: Argon2id com salt único por usuário
- **Rate Limiting**: 100 req/min geral, 5 req/min em auth
- **Headers de Segurança**: Helmet.js (CSP, HSTS, XSS, etc.)
- **CORS**: Configurável via variável de ambiente
- **Auditoria**: Log de todas as ações financeiras importantes
- **LGPD**: Exportação e exclusão de dados do usuário

## 📚 API Endpoints Principais

### Autenticação

- `POST /api/v1/auth/register` - Registro
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/passkey/register/start` - Iniciar registro Passkey
- `POST /api/v1/auth/passkey/register/finish` - Finalizar registro Passkey
- `POST /api/v1/auth/passkey/login/start` - Iniciar login Passkey
- `POST /api/v1/auth/passkey/login/finish` - Finalizar login Passkey

### Finanças

- `GET/POST /api/v1/accounts` - Contas bancárias
- `GET/POST /api/v1/cards` - Cartões de crédito
- `GET/POST /api/v1/transactions` - Transações
- `POST /api/v1/transactions/installment` - Compra parcelada
- `GET/POST /api/v1/invoices` - Faturas
- `GET/POST /api/v1/installments` - Parcelamentos
- `GET/POST /api/v1/bills` - Contas a pagar
- `GET/POST /api/v1/recurring-bills` - Contas recorrentes
- `GET/POST /api/v1/debts` - Dívidas próprias
- `GET/POST /api/v1/debts/owed` - Dívidas de terceiros
- `POST /api/v1/debts/owed/:id/share` - Compartilhar dívida por email

### Relatórios

- `GET /api/v1/reports/spending-by-category`
- `GET /api/v1/reports/spending-by-period`
- `GET /api/v1/reports/cashflow`
- `GET /api/v1/reports/summary` - Dashboard

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

- Abra uma [issue](https://github.com/seu-usuario/oxedindin/issues) para bugs ou sugestões
- Consulte a [documentação da API](http://localhost:3000/docs) em desenvolvimento local

---

**OxeDinDin** - Seu centro de controle financeiro pessoal 💰
