# Running Accora locally

This gets the full stack — Postgres, the NestJS API, and the React web app —
running on a developer machine for real day-to-day use, not just `pnpm test`.

## 1. Prerequisites

- Node.js 20+
- pnpm (`corepack enable` ships it with Node 20+, or `npm i -g pnpm`)
- Docker (simplest way to run Postgres 16), or a local Postgres 16 install

## 2. Get the code

```bash
git clone https://github.com/moayyad44/Accora.git
cd Accora
git checkout claude/integrated-accounting-program-6146gb
pnpm install
```

(This branch hasn't been merged to `main` yet — check out the branch above,
or merge/rebase it first if you'd rather work from `main`.)

## 3. Start Postgres

```bash
docker run -d --name accora-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=accora_dev \
  -p 5432:5432 \
  postgres:16
```

Next time you sit down to work, it's just `docker start accora-postgres` —
the container (and its data) persists until you explicitly remove it.

## 4. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

- `RUNTIME_DATABASE_URL` — change the password segment to
  `change_me_in_production`. The first migration (below) creates the
  low-privilege `app_user` DB role with exactly that password baked in (it's
  plain SQL, so it can't read an env var at migration time) — see
  `scripts/rotate-app-user-password.sh` for how to change it later, once
  you're past pure local use.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — any random string is fine for
  local use (e.g. `openssl rand -base64 48`).

## 5. Create the schema and seed reference data

```bash
pnpm --filter @accora/api exec prisma migrate deploy
pnpm run db:seed
```

The seed step loads the currency list, the ~395 permission definitions, the
10 role templates, and the default chart-of-accounts template — everything a
brand-new company gets cloned from when you register it. It only needs to
run once per database.

## 6. Start the app (two terminals)

```bash
# terminal 1
pnpm --filter @accora/api run start:dev

# terminal 2
pnpm --filter @accora/web run dev
```

The web dev server proxies `/api` to `http://localhost:3000` automatically
(see `apps/web/vite.config.ts`) — no extra env var needed.

## 7. Use it

Open **http://localhost:5173**, click "تسجيل شركة جديدة" (register a new
company), and you're in — real data, real Postgres, the same backend that
every module was live-tested against during development.

## Stopping / resuming

- Stop: Ctrl-C both terminals; `docker stop accora-postgres` if you want
  Postgres down too.
- Resume: `docker start accora-postgres` (skip if still running), then
  re-run step 6. No need to re-run migrate/seed — the data is still there.
