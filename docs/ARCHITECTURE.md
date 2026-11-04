# S Mart architecture

Written 2026-11-04 from the code in `apps/api/src`, `packages/shared/src` and `prisma/schema.prisma`. Items marked *planned* do not exist yet.

## Components
```
 Customer web (Next.js, :3101) --\
 Admin web (Next.js, :3100) -------+--> REST /api/v1 + SSE  -->  NestJS API (:4100)  -->  PostgreSQL (Prisma)
 Android shopping app (planned M2) |                                  |  \--> local disk uploads (StorageDriver)
 Android admin app (planned M2)    |                                  \--> payment providers (COD live; others interface only)
 Windows admin EXE (planned M3) ---/
```
- `apps/api`: NestJS modules (auth, admin, catalog, customer, orders, payments, platform, reports, settings) + Prisma.
- `packages/shared`: Zod schemas, permission list and role definitions, order state machine, pricing functions. Used by the API and (types/validation) by the web apps, so rules exist once.
- `prisma/`: schema, one migration, seed (clearly labelled DEMO data).
- Clients never hold database credentials; they only know the API URL.

## Request flow
1. Helmet, CORS allow-list (`CORS_ORIGINS`), cookie parser and a small JSON body limit run first (`app.factory.ts`).
2. `ThrottlerGuard` (global, `RATE_LIMIT_GLOBAL` per minute per client) then the global `AccessGuard`.
3. `AccessGuard` (`auth/guards.ts`) is **default deny**: a route without exactly one of `@Public`, `@AnyUser`, `@CustomerOnly`, `@StaffAny`, `@Perms(...)` is refused with 403.
4. Zod pipes validate body/query (`common/zod.ts`); handlers call services; the global exception filter returns `{code, message}`.
5. Writes call the audit helper (`common/audit.ts`); status changes publish to the in-process event bus (`common/events.ts`).

## Auth model
- Access token: JWT, 15 minutes by default (`JWT_ACCESS_TTL_SECONDS`), signed with `JWT_ACCESS_SECRET` (>= 32 chars, validated at boot). The token's audience must match the user kind: staff tokens are `admin`, customers `customer`; logging in with the wrong audience is a 401.
- Refresh token: opaque random string, stored hashed, **rotated on every refresh**. Presenting an already-rotated token is detected as reuse and audit-logged (`auth.service.ts`).
- Passwords: argon2id. Unknown e-mails still cost a hash (timing). After `MAX_FAILED_LOGINS` (5) failures the account is locked for `LOCKOUT_MINUTES` (15).
- Two transports: **bearer** (mobile / API clients: `Authorization` header, no CSRF needed) and **cookie mode** for the web apps (httpOnly cookies named `sm_<client>_at` / `sm_<client>_rt`; the client sends `X-Client: admin|customer`, and every non-GET call must also send `X-CSRF`). The admin and customer sites therefore keep separate sessions.
- Authorisation: roles hold string permissions; `super_admin` holds `*`. The permission check is server-side on every route.

## Ownership checks (who may touch which record)
S Mart is single-shop, not multi-tenant. The boundary is **customer-to-customer**: every `/me/*` handler filters by the `userId` taken from the verified token (for example `where: { userId: u.id }`), and an id in the URL that belongs to someone else returns 404, not another user's data. Staff are bounded by permissions, not ownership.

## Real-time (SSE)
See REALTIME.md. Public events (catalogue/price/banner changes) can be received without login; private events (a customer's own order updates, staff notifications) need a one-time ticket. The bus is in-process, so it works for **one API instance**; running several instances needs Redis pub/sub (planned).

## Checkout, transactions and stock concurrency (`orders.service.ts`)
1. The `Idempotency-Key` header is mandatory; the pair (userId, key) is unique on `Order`. A replay returns the original order.
2. Totals are computed from database prices, active offers, coupon rules and settings (`computeTotals` in `packages/shared/src/pricing.ts`); the request body carries no prices.
3. One database transaction: for each line `UPDATE "ProductVariant" SET stock = stock - qty WHERE id = ? AND stock >= qty RETURNING stock` (zero rows = out of stock, whole order rolls back), coupon usage increment guarded the same way, order + items + payment + event rows created, a `StockMovement` row per line with `balanceAfter`.
4. A unique-constraint race on the idempotency key is caught (`P2002`) and resolved to the first order.
5. Cancellation and status moves claim the row with `updateMany({ where: { id, status } })` in a transaction, restock through the same guarded SQL and reverse coupon usage.

## Storage interface
Uploads go through a storage driver (`platform.controller.ts`); the implemented driver writes to `UPLOAD_DIR` on local disk under random names. Swapping to S3/R2 means adding another driver (planned). Uploads are limited to 2 MB, one file per request, validated by content.

## Audit log
`AuditLog` rows (actor, action, entity, IP, metadata) are written for authentication events, uploads and backups (observed in code); admin controllers call the audit helper on their writes. A per-endpoint coverage check was not performed for this document. Staff with `audit.read` read it at `GET /admin/audit-logs`.

## Backups
`scripts/backup.sh` (pg_dump custom format, timestamp, retention) and `scripts/restore-test.sh` (scratch DB, row-count compare) were executed; see BACKUP_RESTORE.md. The API also exposes `GET/POST /admin/backups` and `POST /admin/backups/:name/verify` (permission `backup.manage`). Backups on the same disk as the database are **not** disaster recovery; copy them off-box.

## Health
`GET /api/v1/health` returns `{status, time, version}`.
