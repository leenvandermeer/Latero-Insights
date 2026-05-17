# ── Stage 1: install deps ─────────────────────────────────────────────────────
# Gebruik node:20 (Debian/glibc) voor de build-stages zodat native binaries
# zoals lightningcss correct resolven. Alpine runtime heeft ze niet nodig.
FROM node:20 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build --workspace web
# Bundle migrate.ts → migrate.cjs zo deploy.sh dezelfde runner gebruikt als dev.
RUN node_modules/.bin/esbuild web/scripts/migrate.ts \
    --bundle --platform=node --outfile=migrate.cjs --external:pg

# ── Stage 3: production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone build output — workspace-structuur blijft behouden in de standalone dir
# server.js staat op /app/web/server.js, static files op /app/web/.next/static
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/static ./web/.next/static
COPY --from=builder /app/web/public ./web/public

# Initiële data-bestanden (shared-widgets.json) — dient als volume-seed bij eerste mount.
# process.cwd() = /app/web (web/server.js doet process.chdir(__dirname)), dus
# data-pad = /app/web/data/shared-widgets.json.
COPY --from=builder --chown=nextjs:nodejs /app/web/data ./web/data

# Migration runner — zelfde codepad als lokale ontwikkeling.
# deploy.sh start een --rm container met dit image om migraties toe te passen.
COPY --from=builder /app/migrate.cjs ./migrate.cjs
COPY --from=builder /app/infra/sql/init ./infra/sql/init

# Persistent state directories — mounted as volumes in production
RUN mkdir -p /app/web/.cache \
 && chown nextjs:nodejs /app/web/.cache

USER nextjs
EXPOSE 3000

CMD ["node", "web/server.js"]
