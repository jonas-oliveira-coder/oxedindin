# Multi-stage Dockerfile for OxeDinDin
# Stage 1: Build shared package
FROM node:20-alpine AS shared-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable pnpm && pnpm install --frozen-lockfile --filter @oxedindin/shared...
COPY packages/shared/ ./packages/shared/
RUN cd packages/shared && pnpm build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable pnpm && pnpm install --frozen-lockfile --filter @oxedindin/backend...

COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/backend/ ./packages/backend/
COPY packages/shared/ ./packages/shared/

RUN cd packages/backend && pnpm db:generate && pnpm build

# Stage 3: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable pnpm && pnpm install --frozen-lockfile --filter @oxedindin/frontend...

COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/frontend/ ./packages/frontend/
COPY packages/shared/ ./packages/shared/

RUN cd packages/frontend && pnpm build

# Stage 4: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy backend
COPY --from=backend-builder /app/packages/backend/dist ./dist
COPY --from=backend-builder /app/packages/backend/node_modules ./node_modules
COPY --from=backend-builder /app/packages/backend/package.json ./package.json
COPY --from=backend-builder /app/packages/backend/prisma ./prisma

# Copy frontend build to public folder
COPY --from=frontend-builder /app/packages/frontend/dist ./public

EXPOSE 3000

CMD ["node", "dist/main.js"]