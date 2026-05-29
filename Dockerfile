# syntax=docker/dockerfile:1.6
# F12-K49: production Dockerfile dla deployu na Coolify/Hetzner.
# Multi-stage build z Next.js standalone output → finalny image ~150MB.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ---- Stage 1: install deps ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# F12-K49b: prisma schema potrzebna PRZED npm ci, bo postinstall hook
# w package.json odpala `prisma generate` i bez schemy crashuje.
COPY prisma ./prisma
RUN npm ci

# ---- Stage 2: build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma client generation (postinstall już to robi, ale belt+suspenders)
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: runtime ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user — security best practice
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone output (server.js + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma generated client + schema (potrzebne w runtime)
COPY --from=builder --chown=nextjs:nodejs /app/lib/generated ./lib/generated
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Operacyjne skrypty (create-superadmin, reset-user-password) — standalone
# output ich nie traceuje. tsx doinstalowuje się przez `npx` on-demand;
# runtime deps (bcrypt, @prisma/adapter-pg, prisma client) już są w obrazie.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
