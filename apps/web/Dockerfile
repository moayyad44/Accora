# Build context is the repo root (a pnpm workspace) — see docker-compose.yml
# `build.context: .` / `build.dockerfile: apps/web/Dockerfile`. Building
# from apps/web alone would not see pnpm-lock.yaml or pnpm-workspace.yaml.

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: install the full workspace exactly as locked ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

# ---- build: compile the production SPA bundle ----
FROM deps AS build
COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN pnpm build

# ---- runtime: nginx serving the static bundle + proxying /api to the API container ----
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80
