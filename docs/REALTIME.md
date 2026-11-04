# Real-time updates (SSE)

Implemented in `apps/api/src/platform/platform.controller.ts` and `common/events.ts`.

- Endpoint: `GET /api/v1/realtime/stream` (Server-Sent Events, `text/event-stream`).
- **Public events**: no credentials; used for catalogue, price and banner changes so open storefront pages refresh live.
- **Private events**: first call `POST /api/v1/realtime/ticket` (any signed-in user) to get a short-lived (60 s), **one-time** ticket, then open the stream with that ticket. Customers receive only their own order and notification events; staff receive staff events for permissions they hold (for example new orders). The ticket exists so tokens never appear in a long-lived URL.
- A periodic heartbeat keeps proxies from closing the stream.
- Bus: an in-process emitter. Works for **one API instance**. For several instances, add Redis pub/sub behind the same interface (planned, not built).
- Fallback: clients can poll the normal REST endpoints (for example `GET /me/orders/:id`) if SSE is blocked.
- Admin price changes reach a subscribed customer client; the test that proves this is part of the API test suite (see the parent report for the executed result).
