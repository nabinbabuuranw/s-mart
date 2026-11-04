# S Mart

S Mart is an original shopping ecosystem: one secure API plus an Admin website and a Customer website (Android apps and a Windows admin app are planned). Reference-only inspiration came from a third-party shopping APK; no code, assets or branding were copied (see `docs/REFERENCE_ANALYSIS.md`).

## Honest status (Milestone 1)
- **API** (`apps/api`, NestJS + Prisma + PostgreSQL): 102 REST routes, Swagger at `/api/docs` when `NODE_ENV != production`, JWT + rotating refresh tokens, argon2id, lockout, RBAC with default-deny guard, COD checkout with idempotency and guarded stock updates, returns/refunds, tickets, notifications, SSE, audit log, backup tooling.
- **Admin website** (`apps/admin-web`, port 3100) and **Customer website** (`apps/customer-web`, port 3101): built in this milestone; see the milestone report for what was verified.
- **Not built**: Android apps (M2), Windows .EXE (M3), eSewa/Khalti/Stripe (interfaces only), push notifications, e-mail/SMS, MFA, password reset. Nothing is deployed anywhere; Docker files are written but were not executed (no Docker on the authoring box).
- Demo data is clearly labelled DEMO. Never use the demo seed in production.

Docs: `docs/PRODUCT_SPEC.md`, `DESIGN.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `API.md`, `SECURITY.md`, `REALTIME.md`, `PAYMENTS.md`, `DEPLOYMENT.md`, `BACKUP_RESTORE.md`, `REFERENCE_ANALYSIS.md`, `PLATFORM_FEASIBILITY.md`.

## Quickstart (from a clean clone)
Needs Node 20+ (22 recommended), npm, and PostgreSQL 15+ you can create a database in.
```bash
git clone https://github.com/nabinbabuuranw/s-mart.git && cd s-mart
npm install
# create a database and role (adjust names/port; choose your own password)
createdb smart_dev          # or: psql -c 'CREATE DATABASE smart_dev'
cp .env.example .env        # then edit DATABASE_URL to match your database
# secrets
sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -base64 48)|" .env
sed -i "s|^SEED_DEMO_PASSWORD=.*|SEED_DEMO_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')|" .env
npm run build:shared
npm run db:generate
npm run db:migrate
npm run db:seed             # DEMO data only
npm run dev:api             # http://localhost:4100  (docs: /api/docs)
npm run dev:admin           # http://localhost:3100  (second terminal)
npm run dev:customer        # http://localhost:3101  (third terminal)
```
Demo logins (DEMO data; the password is the `SEED_DEMO_PASSWORD` value you put in `.env`): admin@smart.test, customer1@smart.test, customer2@smart.test, finance@smart.test, inventory@smart.test, manager@smart.test, orders@smart.test, super@smart.test, support@smart.example, support@smart.test. Staff sign in on the admin site, customers on the customer site.

Tests: create a database whose name contains `test`, set `TEST_DATABASE_URL` in `.env`, then `npm test` (the suite wipes that database).
Backups: `scripts/backup.sh`, `scripts/restore-test.sh` (see `docs/BACKUP_RESTORE.md`).

### What was verified for this quickstart (2026-11-04, authoring box)
Run against a scratch database `smart_readme_check` (dropped afterwards), with a different port, leaving the dev API and `smart_dev` untouched: `createdb` ok; `prisma migrate deploy` applied the migration; `npm run db:seed` completed (9 users, 13 products, 8 roles in the scratch database); the built API (`node apps/api/dist/main.js`) started on another port and `/api/v1/health` returned 200 and `/api/docs` returned 200.
**Not re-run** (to avoid disturbing the running dev servers): `npm install` from an empty directory, `npm run db:generate` (already generated), and starting the two Next.js apps from a clean clone. The `sed` secret-generation lines and the dev-server commands are unexecuted as written.

## Layout
`apps/api`, `apps/admin-web`, `apps/customer-web`, `packages/shared` (Zod schemas, permissions, order state machine, pricing), `prisma/` (schema, migration, seed), `infra/` (Dockerfiles, compose), `scripts/` (backup, restore test), `docs/`, `.github/workflows/ci.yml`.

## Licence
No licence chosen yet (all rights reserved until the owner picks one).
