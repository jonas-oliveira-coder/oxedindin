# Backend Dockerfile
FROM node:20-alpine AS deps
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --workspaces --include-workspace-root --filter @oxedindin/backend...

# Build the application
FROM deps AS builder
WORKDIR /repo

COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

RUN npm run build --workspace=@oxedindin/shared && npm run build --workspace=@oxedindin/backend

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /repo/packages/backend/dist ./dist
COPY --from=builder /repo/packages/backend/drizzle ./drizzle
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/backend/node_modules ./node_modules
COPY --from=builder /repo/packages/backend/package.json ./package.json
COPY --from=builder /repo/packages/shared ./packages/shared

EXPOSE 3000

# Run migrations explicitly before starting the server. If migrations fail,
# the server does not start (fail-fast). The app also migrates on startup as
# an idempotent fallback (drizzle tracks already-applied migrations).
CMD ["sh", "-c", "node dist/migrate.js && node dist/main.js"]