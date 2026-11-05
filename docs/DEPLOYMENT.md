# Deployment

Honest status (2026-11-04): there is **no server** today. Nothing is deployed. The compose and Dockerfiles are **written, not executed** on the authoring box (Docker is not installed there). The local non-Docker path below is the one that was actually run.

## Environment variables
Authoritative list: `.env.example` (verified against `loadEnv()` in `apps/api/src/config/env.ts`). Required: `DATABASE_URL`, `JWT_ACCESS_SECRET` (>= 32 chars). Important in production: `NODE_ENV=production` (secure cookies, Swagger off), `CORS_ORIGINS` (exact web origins), `PUBLIC_API_URL`, `UPLOAD_DIR`, `BACKUP_DIR`. Optional: `RATE_LIMIT_GLOBAL`, `RATE_LIMIT_AUTH`, `MAX_FAILED_LOGINS`, `LOCKOUT_MINUTES`, payment keys, `FCM_SERVICE_ACCOUNT_JSON`. `SEED_DEMO_PASSWORD` is for the demo seed only; never seed demo users in production.

## Option A: local machine (verified path, no Docker)
Follow the README quickstart. Good for demos and development.

## Option B: Docker Compose on any machine with Docker (written, not executed)
```
cp .env.example .env     # fill POSTGRES_PASSWORD, JWT_ACCESS_SECRET, CORS_ORIGINS, PUBLIC_API_URL
docker compose -f infra/docker-compose.yml --env-file .env up --build
```
Needs from Nabin: a machine with Docker. Not yet verified: image builds, that the web apps pick up `NEXT_PUBLIC_API_URL` (the web apps may read the API URL another way; confirm with the web code), HTTPS.

## Option C: free-tier managed PostgreSQL + free Node host (unverified, no account created)
Create a free PostgreSQL database at a provider with a free tier, set `DATABASE_URL`, run `npm run db:migrate` once, run the API on a free Node web host (build `npm run build:shared && npm run build -w @smart/api`, start `node apps/api/dist/main.js`), and host the two Next.js apps on a free Next-capable host with the API URL set. Caveats to check at signup (terms change, none verified here): free hosts may sleep when idle (breaks SSE), free databases may expire or have small limits, uploads on an ephemeral disk are lost (needs the S3/R2 storage driver, planned), `pg_dump` access may be limited. Needs from Nabin: the provider accounts (his decision), a domain if he wants one.

## Option D: a future VPS (Docker or Coolify)
Run Option B on the VPS behind a reverse proxy (Caddy/Nginx or Coolify's proxy) with HTTPS, set the CSP headers for the Next apps, schedule `scripts/backup.sh` with cron and copy dumps off-box. Needs from Nabin: a VPS, a domain and DNS access.

## Backups
See BACKUP_RESTORE.md. Daily cron plus an off-box copy; run `scripts/restore-test.sh` after changing the schema.

## Rollback
- Application: redeploy the previous image/commit (`git checkout <tag>`; rebuild).
- Database: migrations are forward-only (`prisma migrate deploy`). Take a backup **before** each deploy that contains a migration; to roll back, restore that dump into a new database and repoint `DATABASE_URL` (procedure in BACKUP_RESTORE.md).
- Keep the previous uploads directory untouched; the API never deletes files on deploy.

## CI
`.github/workflows/ci.yml` (written; it runs on GitHub once the repo is pushed, not yet executed): install, build shared, `prisma migrate deploy` against a Postgres service, API tests (the suite needs `TEST_DATABASE_URL` and resets that database), build the API and both web apps. It uses throwaway secrets generated in the run; no repository secrets.

## NODE_ENV=production for deployment (2026-11-05)
- The repo's `.env` (and `.env.example`) sets `NODE_ENV=development` for local work. On a server, set `NODE_ENV=production` in the environment that runs the API (`node apps/api/dist/main.js`): it turns off Swagger (`/api/docs` returns 404), enables secure cookies, and is what the API checks.
- The two web apps' `build` scripts force `NODE_ENV=production` themselves (`scripts/next-build.mjs`), so `npm run build` works even when `.env` is sourced into the shell. Next.js fails to prerender `/404` under `NODE_ENV=development` (`<Html> should not be imported outside of pages/_document`), which is why the override exists. Starting a built web app (`next start`) should also run with `NODE_ENV=production`.
- Check before going live: `curl -s -o /dev/null -w '%{http_code}' https://<api-host>/api/docs` returns 404, and both web builds run with the production `.env` you deploy with.
