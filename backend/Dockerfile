# syntax=docker/dockerfile:1

# Stage 1: Build Application
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace configuration and manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install full workspace dependencies for building
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared library first, then backend
RUN pnpm --filter @palmsight/shared build
RUN pnpm --filter backend build

# Stage 2: Production Dependencies
FROM node:22-alpine AS prod-deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN pnpm install --prod --frozen-lockfile

# Stage 3: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

# Security: Non-root user
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nestjs -G nodejs

# Copy runtime node_modules and built assets
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/shared/package.json ./shared/package.json
COPY --from=builder --chown=nestjs:nodejs /app/shared/dist ./shared/dist
COPY --from=builder --chown=nestjs:nodejs /app/backend/package.json ./backend/package.json
COPY --from=builder --chown=nestjs:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/backend/scripts ./backend/scripts

USER nestjs

WORKDIR /app/backend

EXPOSE 4000

CMD ["node", "dist/main.js"]
