# ── Stage 1: install deps ─────────────────────────────────────────────────────
# Build context: repo root (npm workspace — package-lock.json zit in de root)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/
RUN npm ci --workspace web

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace web

# ── Stage 3: production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone build output (Next.js standalone schrijft naar web/.next/standalone)
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

# Persistent state directories — mounted as volumes in production
RUN mkdir -p /app/.cache /app/data \
 && chown nextjs:nodejs /app/.cache /app/data

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
