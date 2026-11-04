# S Mart security: threat model and controls

Date: 2026-11-04. This lists controls **present in code** (with file) and **residual risks**. It is not a penetration-test report and S Mart is not claimed to be fully secure.

## Controls in code
| Threat | Control | Where |
|---|---|---|
| Forgotten authorisation on a route | Global default-deny guard; route needs an explicit access decorator | `apps/api/src/auth/guards.ts`, `common/auth.ts` |
| Customer reads/changes another customer's data (IDOR) | Queries scoped by token user id; foreign ids return 404 | `customer/customer.controller.ts`, `orders/orders.service.ts` |
| Customer calls admin endpoints | `@Perms` requires a staff token with the permission; customers have no permissions | `auth/guards.ts`, `packages/shared/src/permissions.ts` |
| Privilege escalation via request body | Role/permissions never read from client payloads for auth; Zod schemas strip unknown fields; role changes need `users.manage` / `roles.manage` | `common/zod.ts`, `admin/admin.controller.ts` |
| Weak passwords at rest | argon2id hashing | `auth/auth.service.ts` |
| Brute force / credential stuffing | Per-route throttles (register/login 10 per minute, refresh 30 per minute; fixed in `@Throttle`, the `RATE_LIMIT_AUTH` env var is defined but these routes use the fixed values), global throttle, account lockout (5 failures / 15 min by default) | `auth/auth.controller.ts`, `app.module.ts`, `auth/auth.service.ts` |
| Stolen refresh token | Hashed storage, rotation, reuse detection with audit entry | `auth/auth.service.ts` |
| Token confusion (staff vs customer) | Audience claim must match user kind | `auth/auth.service.ts`, `auth/guards.ts` |
| CSRF on cookie sessions | httpOnly cookies, `X-Client` + `X-CSRF` required on non-GET in cookie mode; bearer mode is not cookie-based | `auth/guards.ts` |
| XSS / clickjacking / sniffing | Helmet headers on the API; JSON-only responses; uploaded files served with safe headers | `app.factory.ts`, `platform/platform.controller.ts` |
| Cross-origin abuse | CORS allow-list from env | `app.factory.ts`, `config/env.ts` |
| SQL injection | Prisma parameterised queries; the only raw SQL uses tagged-template parameters (stock updates) | `orders/orders.service.ts` |
| Price tampering | Prices and totals computed server-side; client prices ignored | `orders/orders.service.ts`, `packages/shared/src/pricing.ts` |
| Double submit / replay of checkout | Mandatory Idempotency-Key, unique (userId, key) | `orders/orders.service.ts`, `prisma/schema.prisma` |
| Overselling under concurrency | Guarded `UPDATE ... WHERE stock >= qty` in one transaction | `orders/orders.service.ts` |
| Malicious uploads | 2 MB cap, single file, content (magic-byte) type check, random server-side names, strict file-name pattern on download (no path traversal) | `platform/platform.controller.ts` |
| Fake "paid" orders | Paid state set only by server-side steps; gateways disabled without keys | `payments/payments.service.ts`, `orders/orders.service.ts` |
| Secrets in git | `.env` git-ignored; `.env.example` has placeholders; env validated at boot (secret length) | `.gitignore`, `config/env.ts` |
| Untraceable admin actions | Audit log (see ARCHITECTURE.md for coverage caveat) | `common/audit.ts` |
| Backup tooling abuse | Fixed arguments, name pattern, permission `backup.manage` | `platform/platform.controller.ts` |

## Residual risks (honest list)
- **No MFA** for any account, including super_admin.
- **In-memory throttler and event bus**: limits reset on restart and do not work across several API instances; SSE fan-out is single-instance. Redis-backed versions are planned.
- **No virus/malware scanning** of uploads; only type, size and name checks. Uploaded files are publicly readable by their random URL.
- **No CAPTCHA** on register/login/support forms.
- **No e-mail verification and no password reset**, because no mail provider is configured (planned). Lost passwords need an admin.
- **No SMS/e-mail alerts** on suspicious logins.
- **CSP for the Next.js apps** is not set yet; it must be configured at deploy (reverse proxy or `next.config` headers) with the real API origin.
- **TLS** is not terminated by the app; production needs a reverse proxy with HTTPS and secure cookies (`NODE_ENV=production`).
- **Dependency advisories** are not tracked in CI yet (`npm audit` is not part of the workflow).
- Payment gateways are untested against any provider; they are disabled by default.
- Uploads and backups live on the API host's disk; losing the disk loses both unless copied off-box.
- Test evidence (counts of security tests that passed) belongs to the parent's final report; this document does not assert them.
