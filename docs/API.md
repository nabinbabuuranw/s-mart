# S Mart REST API (/api/v1)

Generated from the controller decorators on 2026-11-04: 102 routes. Interactive docs: `/api/docs` (Swagger, mounted only when `NODE_ENV != production`). Base path `/api/v1`.

## Access model
- Every route must carry exactly one access decorator or the global `AccessGuard` answers 403 (default deny).
- `@Public()` = no token. `@AnyUser()` = any valid token. `@CustomerOnly()` = token for a non-staff user. `@StaffAny()` = any staff token. `@Perms('x.y')` = staff token whose role grants that permission (`super_admin` has `*`).
- Customer routes (`/me/*`, `/checkout`) always scope queries by the user id from the verified token; ids in the URL are never trusted alone.
- Tokens: send `Authorization: Bearer <accessToken>` (mobile / API clients) or use cookie mode from the web apps (`X-Client: admin|customer` on every call; `X-CSRF: 1` on every non-GET call). `POST /auth/login` takes `{email, password, audience: "admin"|"customer"}`; an audience mismatch is a 401.
- Errors are JSON `{ code, message, ... }` (validation errors are Zod issues; throttled calls return 429).
- Lists use `page`/`pageSize`-style query schemas validated by Zod; the exact fields of each body/query are the Zod schemas named in the tables (in `packages/shared/src/schemas.ts` and the controllers).

## admin/analytics

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/analytics/summary` | perm `analytics.view` | - | daysQ |  |

## admin/audit-logs

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/audit-logs` | perm `audit.read` | - | q1 |  |

## admin/backups

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/backups` | perm `backup.manage` | - | - |  |
| POST | `/api/v1/admin/backups` | perm `backup.manage` | - | - |  |
| POST | `/api/v1/admin/backups/:name/verify` | perm `backup.manage` | - | - |  |

## admin/banners

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/banners` | perm `banners.write` | - | - |  |
| POST | `/api/v1/admin/banners` | perm `banners.write`, perm `banners.write` | bannerSchema | - |  |
| PUT | `/api/v1/admin/banners/:id` | perm `banners.write` | bannerSchema | - |  |
| DELETE | `/api/v1/admin/banners/:id` | perm `banners.write` | - | - |  |

## admin/categories

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/categories` | perm `products.read` | - | - |  |
| POST | `/api/v1/admin/categories` | perm `categories.write` | categorySchema | - |  |
| PATCH | `/api/v1/admin/categories/:id` | perm `categories.write` | - | - |  |
| DELETE | `/api/v1/admin/categories/:id` | perm `categories.write` | - | - |  |

## admin/coupons

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/coupons` | perm `pricing.write` | - | - |  |
| POST | `/api/v1/admin/coupons` | perm `pricing.write`, perm `pricing.write` | couponSchema | - |  |
| PUT | `/api/v1/admin/coupons/:id` | perm `pricing.write` | couponSchema | - |  |
| DELETE | `/api/v1/admin/coupons/:id` | perm `pricing.write` | - | - |  |

## admin/customers

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/customers` | perm `customers.read` | - | q1 |  |
| GET | `/api/v1/admin/customers/:id` | perm `customers.read` | - | - |  |
| PATCH | `/api/v1/admin/customers/:id` | perm `customers.write` | - | - |  |

## admin/inventory

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/inventory` | perm `inventory.read` | - | adminList |  |
| GET | `/api/v1/admin/inventory/:variantId/ledger` | perm `inventory.read` | - | - |  |
| POST | `/api/v1/admin/inventory/:variantId/adjust` | perm `inventory.write` | stockAdjustSchema | - |  |

## admin/me

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/me` | any staff | - | - |  |

## admin/notifications

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/notifications` | perm `dashboard.view` | - | - |  |
| POST | `/api/v1/admin/notifications/read-all` | perm `dashboard.view` | - | - |  |

## admin/offers

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/offers` | perm `pricing.write` | - | - |  |
| POST | `/api/v1/admin/offers` | perm `pricing.write`, perm `pricing.write` | offerSchema | - |  |
| PUT | `/api/v1/admin/offers/:id` | perm `pricing.write` | offerSchema | - |  |
| DELETE | `/api/v1/admin/offers/:id` | perm `pricing.write` | - | - |  |

## admin/orders

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/orders` | perm `orders.read` | - | list |  |
| GET | `/api/v1/admin/orders/:id` | perm `orders.read` | - | - |  |
| PATCH | `/api/v1/admin/orders/:id/status` | perm `orders.update` | orderStatusSchema | - |  |
| POST | `/api/v1/admin/orders/:id/ship` | perm `orders.ship` | shipSchema | - |  |
| POST | `/api/v1/admin/orders/:id/refunds` | perm `refunds.write` | refundSchema | - |  |

## admin/payments

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/payments` | perm `payments.read` | - | paginationSchema |  |

## admin/permissions-catalog

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/permissions-catalog` | any staff | - | - |  |

## admin/products

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/products` | perm `products.read` | - | adminList |  |
| GET | `/api/v1/admin/products/:id` | perm `products.read` | - | - |  |
| POST | `/api/v1/admin/products` | perm `products.write` | productSchema | - |  |
| PATCH | `/api/v1/admin/products/:id` | perm `products.write` | productUpdateSchema | - |  |
| DELETE | `/api/v1/admin/products/:id` | perm `products.write` | - | - |  |

## admin/reports

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/reports/:type` | perm `reports.export` | - | repQ |  |

## admin/returns

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/returns` | perm `returns.manage` | - | - |  |
| POST | `/api/v1/admin/returns/:id/decision` | perm `returns.manage` | returnDecisionSchema | - |  |

## admin/roles

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/roles` | perm `users.manage` | - | - |  |
| POST | `/api/v1/admin/roles` | perm `roles.manage` | roleSchema | - |  |
| PUT | `/api/v1/admin/roles/:id` | perm `roles.manage` | - | - |  |

## admin/settings

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/settings` | perm `settings.write` | - | - |  |
| PUT | `/api/v1/admin/settings` | perm `settings.write`, perm `settings.write` | settingsSchema | - |  |

## admin/tickets

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/tickets` | perm `tickets.read` | - | q1 |  |
| GET | `/api/v1/admin/tickets/:id` | perm `tickets.read` | - | - |  |
| POST | `/api/v1/admin/tickets/:id/messages` | perm `tickets.manage` | ticketMessageSchema | - |  |
| PATCH | `/api/v1/admin/tickets/:id` | perm `tickets.manage` | ticketUpdateSchema | - |  |

## admin/uploads

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| POST | `/api/v1/admin/uploads` | perm `uploads.write` | - | - |  |

## admin/users

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/users` | perm `users.manage` | - | - |  |
| POST | `/api/v1/admin/users` | perm `users.manage` | staffUserSchema | - |  |
| PATCH | `/api/v1/admin/users/:id` | perm `users.manage` | staffUserUpdateSchema | - |  |

## auth

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/register` | public | registerSchema | - |  |
| POST | `/api/v1/auth/login` | public | loginSchema | - |  |
| POST | `/api/v1/auth/refresh` | public | refreshSchema | - |  |
| POST | `/api/v1/auth/logout` | public | refreshSchema | - |  |
| GET | `/api/v1/auth/me` | any signed-in user | - | - |  |
| PATCH | `/api/v1/auth/password` | any signed-in user | passwordChangeSchema | - |  |

## catalog

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/catalog/config` | public | - | - |  |
| GET | `/api/v1/catalog/categories` | public | - | - |  |
| GET | `/api/v1/catalog/banners` | public | - | - |  |
| GET | `/api/v1/catalog/offers` | public | - | - |  |
| GET | `/api/v1/catalog/products` | public | - | listQuery |  |
| GET | `/api/v1/catalog/products/:slug` | public | - | - |  |

## checkout

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| POST | `/api/v1/checkout` | customer only | checkoutSchema | - |  |

## files

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/files/:name` | public | - | - |  |

## health

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/health` | public | - | - |  |

## me

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/me/profile` | customer only | - | - |  |
| PATCH | `/api/v1/me/profile` | customer only | profileSchema | - |  |
| GET | `/api/v1/me/cart` | customer only | - | - |  |
| POST | `/api/v1/me/cart/items` | customer only | cartAddSchema | - |  |
| PUT | `/api/v1/me/cart/items/:variantId` | customer only | cartSetSchema | - |  |
| DELETE | `/api/v1/me/cart` | customer only | - | - |  |
| GET | `/api/v1/me/wishlist` | customer only | - | - |  |
| PUT | `/api/v1/me/wishlist/:productId` | customer only | - | - |  |
| DELETE | `/api/v1/me/wishlist/:productId` | customer only | - | - |  |
| GET | `/api/v1/me/addresses` | customer only | - | - |  |
| POST | `/api/v1/me/addresses` | customer only | addressSchema | - |  |
| PUT | `/api/v1/me/addresses/:id` | customer only | addressSchema | - |  |
| DELETE | `/api/v1/me/addresses/:id` | customer only | - | - |  |
| GET | `/api/v1/me/notifications` | customer only | - | page |  |
| POST | `/api/v1/me/notifications/read-all` | customer only | - | - |  |
| POST | `/api/v1/me/notifications/:id/read` | customer only | - | - |  |
| GET | `/api/v1/me/tickets` | customer only | - | - |  |
| POST | `/api/v1/me/tickets` | customer only | ticketCreateSchema | - |  |
| GET | `/api/v1/me/tickets/:id` | customer only | - | - |  |
| POST | `/api/v1/me/tickets/:id/messages` | customer only | ticketMessageSchema | - |  |
| GET | `/api/v1/me/orders` | customer only | - | list |  |
| GET | `/api/v1/me/orders/:id` | customer only | - | - |  |
| POST | `/api/v1/me/orders/:id/cancel` | customer only, customer only | cancelSchema | - |  |
| POST | `/api/v1/me/orders/:id/returns` | customer only | returnSchema | - |  |
| GET | `/api/v1/me/returns` | customer only | - | - |  |
| GET | `/api/v1/me/payments` | customer only | - | - |  |

## payment-methods

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| GET | `/api/v1/payment-methods` | public | - | - |  |

## realtime

| Method | Path | Access | Body schema | Query schema | Notes |
|---|---|---|---|---|---|
| POST | `/api/v1/realtime/ticket` | any signed-in user | - | - |  |
| GET (SSE) | `/api/v1/realtime/stream` | public | - | - |  |

## Behaviour notes (read from code)
- `POST /checkout` requires an `Idempotency-Key` header (8-80 chars, `[A-Za-z0-9._:-]`). Totals (subtotal, offer discount, coupon, shipping, tax) are computed on the server from the database; client-sent prices are ignored. A repeated key returns the original order with `idempotentReplay: true`.
- `POST /me/orders/:id/cancel`: customers may cancel only while the order is `pending_payment`, `placed` or `confirmed`; stock and coupon usage are returned in the same transaction.
- `POST /me/orders/:id/returns`: only `delivered` orders, inside the `returnWindowDays` setting (default 7).
- `PATCH /admin/orders/:id/status` accepts only confirmed, packed, out_for_delivery, delivered, cancelled; shipping uses `POST /admin/orders/:id/ship`; refunds use `POST /admin/orders/:id/refunds`.
- `POST /admin/uploads`: multipart `file`, max 2 MB, one file; PNG/JPEG/WebP/GIF validated by content, stored under a random name. `GET /files/:name` serves it publicly.
- `GET /realtime/stream` is Server-Sent Events; see REALTIME.md for the ticket flow.
- `GET /admin/reports/:type` exports reports (permission `reports.export`); `GET /admin/analytics/summary` feeds the dashboard.
