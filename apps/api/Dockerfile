# Multi-stage: the runtime image carries no TypeScript, no source, no dev deps.

# ---------- deps ----------
FROM docker.io/library/node:20-alpine AS deps
WORKDIR /app

# Manifests only, so this layer is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace @commander/api --workspace @commander/shared --include-workspace-root

# ---------- build ----------
FROM docker.io/library/node:20-alpine AS build
WORKDIR /app

# The whole deps stage, not individual node_modules paths: npm workspaces
# hoists to the root, so apps/api/node_modules and packages/shared/node_modules
# usually do not exist and COPYing them by name fails the build. Taking /app
# whole also carries the @commander/* workspace symlinks intact.
COPY --from=deps /app ./

COPY tsconfig.base.json package.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# The client is generated from the schema, so it must exist before tsc runs.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build --workspace @commander/shared \
 && npm run build --workspace @commander/api

RUN npm prune --omit=dev

# ---------- runtime ----------
FROM docker.io/library/node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Alpine's node image ships a `node` user; running as root in a container that
# talks to the internet is an avoidable risk.
RUN apk add --no-cache dumb-init

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma

USER node
EXPOSE 4000

# dumb-init makes PID 1 forward SIGTERM, which is what triggers the graceful
# shutdown in main.ts. Without it, `docker compose down` kills mid-delivery.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]
