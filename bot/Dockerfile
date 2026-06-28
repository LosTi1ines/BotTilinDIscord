# ═══════════════════════════════════════════════════════════════
# bot/Dockerfile — Multi-stage build con pnpm
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder

# Habilitar corepack para pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copiar manifiestos primero (cache de dependencias)
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Copiar fuente y compilar TypeScript
COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm run build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine AS production

LABEL maintainer="Equipo Música Bot"
LABEL description="Discord Music Bot — Control Plane (Node.js + Shoukaku)"

# Habilitar corepack para pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Solo dependencias de producción
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Copiar artefactos compilados
COPY --from=builder /app/dist ./dist

# Directorio de logs
RUN mkdir -p /app/logs

# Ejecutar como usuario no-root (seguridad)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "dist/main.js"]
