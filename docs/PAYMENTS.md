# Payments

Code: `apps/api/src/payments/payments.service.ts`, `orders/orders.service.ts`.

| Provider | Status | Needs |
|---|---|---|
| Cash on delivery (`cod`) | **Live** | nothing; can be switched off with the `codEnabled` setting |
| eSewa (`esewa`) | Interface only, reports "not enabled" | `ESEWA_SECRET_KEY` from Nabin's eSewa merchant account |
| Khalti (`khalti`) | Interface only | `KHALTI_SECRET_KEY` |
| Stripe (`stripe`) | Interface only | `STRIPE_SECRET_KEY` |

Rules:
- `GET /payment-methods` lists each provider and whether it is enabled; checkout rejects a disabled provider with `payment_method_unavailable`.
- Order totals are computed on the server. An order is **paid only after a server-side step**: for COD, when staff mark the order delivered; for a gateway, after the server verifies the transaction with the provider (not written yet).
- No card data is accepted, stored or logged. A card gateway must host the card form.
- Refunds are recorded by staff (`refunds.write`); they do not move money by themselves.
- No gateway has been called from this code. Sandbox testing starts only when Nabin supplies merchant sandbox keys.
