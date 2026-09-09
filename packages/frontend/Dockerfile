# Frontend Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --workspaces --include-workspace-root --filter @oxedindin/frontend...

# Build the application
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

RUN npm run build --workspace=@oxedindin/frontend

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/frontend/dist ./dist
COPY --from=builder /app/packages/frontend/node_modules ./node_modules
COPY --from=builder /app/packages/frontend/package.json ./package.json

EXPOSE 5173

CMD ["npx", "vite", "preview", "--host", "--port", "5173"]