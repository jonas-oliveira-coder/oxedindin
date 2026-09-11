# OxeDinDin - Gerenciador Financeiro Pessoal

Uma plataforma completa de gerenciamento de finanças pessoais, construída com foco em segurança, privacidade e experiência do usuário.

## 🚀 Tecnologias

### Backend

- **Fastify** - Framework web rápido e de baixa sobrecarga
- **Drizzle ORM** - ORM TypeScript moderno e type-safe para PostgreSQL
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
- **npm Workspaces** - Monorepo

## 📁 Estrutura do Projeto

```
oxedindin/
├── .github/workflows/     # CI/CD pipelines
├── packages/
│   ├── shared/            # Tipos e utilitários compartilhados
│   ├── backend/           # API Fastify
│   │   ├── drizzle/       # Migrações SQL do Drizzle
│   │   └── src/           # Código fonte do backend (incluindo src/db/schema)
│   └── frontend/          # SPA React + Vite
│       └── src/           # Código fonte do frontend
├── docker-compose.yml     # Desenvolvimento local
└── Dockerfile             # Build multi-stage para produção
```

## 🛠️ Desenvolvimento Local

### Pré-requisitos

- Node.js 20+
- npm 10+
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
npm install

# Gere as migrações do Drizzle (se houver alterações de schema)
npm run db:generate

# Execute as migrações
npm run db:migrate

# Inicie em modo desenvolvimento
npm run dev
```

A aplicação estará disponível em:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Documentação da API: http://localhost:3000/docs

## 📦 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia frontend e backend
npm run dev:backend      # Apenas backend
npm run dev:frontend     # Apenas frontend

# Build
npm run build            # Build de todos os pacotes
npm run build:backend    # Build do backend
npm run build:frontend   # Build do frontend

# Banco de dados
npm run db:generate      # Gera migrações SQL com Drizzle Kit
npm run db:push          # Push schema diretamente para o DB (dev)
npm run db:migrate       # Executa migrações pendentes com Drizzle Kit
npm run db:studio        # Abre o Drizzle Studio
npm run db:seed          # Popula dados de exemplo (se configurado)

# Testes
npm run test             # Testes unitários
npm run test:e2e         # Testes E2E (frontend)

# Docker
npm run docker:build     # Build da imagem Docker
npm run docker:run       # Executa container localmente
```

## 🏗️ Deploy em Produção

O compose de exemplo para o Coolify está em
[docker-compose.coolify.example.yml](docker-compose.coolify.example.yml). Ele usa as
imagens pré-compiladas do GHCR e mantém PostgreSQL e Redis na rede externa `coolify`.

### Coolify + GHCR

1. No servidor do Coolify, crie a rede externa caso ela ainda não exista:

   ```bash
   docker network create coolify
   ```

2. Crie um recurso **Docker Compose** no Coolify e use o conteúdo de
   `docker-compose.coolify.example.yml`.

3. Configure as variáveis de ambiente no Coolify:

   - `SERVICE_PASSWORD_POSTGRES`
   - `SERVICE_PASSWORD_JWT`
   - `SERVICE_PASSWORD_JWT_REFRESH`
   - `SERVICE_PASSWORD_COOKIE`
   - `FRONTEND_URL` (por exemplo, `https://app.seudominio.com`)
   - `API_URL` (por exemplo, `https://api.seudominio.com`)
   - `GOOGLE_CLIENT_ID` (opcional)
   - `GOOGLE_CLIENT_SECRET` (opcional)

4. Configure o domínio e a porta `5173` no serviço `frontend`. Se publicar a API
   separadamente, configure o domínio e a porta `3000` no serviço `backend`.

5. Configure os secrets no GitHub para o workflow de publicação:

   - `COOLIFY_WEBHOOK_URL` - Webhook do Coolify
   - `COOLIFY_TOKEN` - Token de autenticação (se necessário)

O frontend é uma aplicação Vite estática. Portanto, `VITE_API_URL` precisa estar
definido durante o build da imagem do frontend; definir essa variável apenas no
runtime do compose não altera o JavaScript já compilado.

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
