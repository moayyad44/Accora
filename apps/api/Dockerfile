# Build context is the repo root (a pnpm workspace) — see docker-compose.yml
# `build.context: .` / `build.dockerfile: apps/api/Dockerfile`. Building
# from apps/api alone would not see pnpm-lock.yaml or pnpm-workspace.yaml.

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: install the full workspace exactly as locked ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

# ---- build: generate the Prisma client + compile TypeScript ----
FROM deps AS build
COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN pnpm prisma:generate
RUN pnpm build

# ---- runtime: only what's needed to run the compiled server ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules /repo/node_modules
COPY --from=deps /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build /repo/apps/api/prisma /repo/apps/api/prisma
COPY apps/api/package.json /repo/apps/api/package.json
WORKDIR /repo/apps/api

EXPOSE 3000

# Applies any migrations not yet on the target database, then starts the
# server — safe to run on every container start (a no-op once the DB is
# current), which is how a rolling deploy is expected to pick up new
# migrations without a separate manual step.
CMD ["sh", "-c", "pnpm prisma:deploy && node dist/src/main.js"]
