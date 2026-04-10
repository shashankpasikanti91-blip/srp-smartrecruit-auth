# ──────────────────────────────────────────────────────────────────────────────
# SRP AI Labs — SmartRecruit Next.js — Production Dockerfile
# Multi-stage build with standalone output (~120MB final image)
# ──────────────────────────────────────────────────────────────────────────────

# Stage 1: Install deps
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .

RUN npm run build
RUN mkdir -p public

# Stage 3: Production runner
FROM node:22-alpine AS runner
RUN apk add --no-cache tini
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# Copy runtime-require()'d packages not picked up by standalone tracing
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/pdf-parse     ./node_modules/pdf-parse
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/mammoth       ./node_modules/mammoth
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/node-ensure   ./node_modules/node-ensure


USER nextjs
EXPOSE 3000

# Use tini to handle zombie processes
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
