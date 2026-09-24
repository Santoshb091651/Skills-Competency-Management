# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Base — shared by every build stage
#
# Corporate networks that inspect TLS (Zscaler, Netskope and similar) present a
# certificate signed by an internal root CA. The host trusts it; a fresh
# container does not, so `npm ci` fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY.
#
# Drop any .crt files into docker/ca/ and they are installed into the image's
# trust store. The directory ships empty, so on an unfiltered network this is a
# no-op and nothing needs configuring.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app
COPY docker/ca/ /usr/local/share/ca-certificates/
# No `apk add` here on purpose: node:alpine already ships ca-certificates, and
# reaching the Alpine package index is itself blocked on the very networks this
# step exists to work around.
RUN set -e; \
    if ls /usr/local/share/ca-certificates/*.crt >/dev/null 2>&1; then \
      if command -v update-ca-certificates >/dev/null 2>&1; then \
        update-ca-certificates; \
      else \
        cat /usr/local/share/ca-certificates/*.crt >> /etc/ssl/certs/ca-certificates.crt; \
      fi; \
      npm config set cafile /etc/ssl/certs/ca-certificates.crt; \
      echo "installed corporate CA certificate(s)"; \
    else \
      echo "no corporate CA supplied; continuing with the default trust store"; \
    fi
# Makes Node use the system trust store, which the step above just updated.
ENV NODE_OPTIONS=--use-openssl-ca

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# Migration runner (one-shot)
#
# Holds the Prisma CLI so the runtime image does not, which also keeps the
# CLI's transitive dependencies out of anything long-running.
# ---------------------------------------------------------------------------
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json prisma7.config.ts tsconfig.json ./
COPY prisma ./prisma
# The seed script imports the generated client, so it must exist in this stage.
RUN npx prisma generate
# Both steps are idempotent, so re-running the container is safe. Set
# SEED_DEMO_DATA=false on a real deployment to apply migrations only.
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$SEED_DEMO_DATA\" = \"true\" ]; then npx tsx prisma/seed.ts; else echo 'SEED_DEMO_DATA is not true; skipping demo seed'; fi"]

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
