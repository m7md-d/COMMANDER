# The SPA is static after build, so the runtime image is nginx with no Node.

FROM docker.io/library/node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace @commander/web --workspace @commander/shared --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run build --workspace @commander/shared \
 && npm run build --workspace @commander/web

FROM docker.io/library/nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
