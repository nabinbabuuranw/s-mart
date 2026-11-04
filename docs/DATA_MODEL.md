# S Mart data model

Source of truth: `prisma/schema.prisma` (30 models, 8 enums, one migration `20261104100708_init`). The diagram below was generated from that file on 2026-11-04; attributes show scalar columns only (PK/UK/FK marks are derived from `@id`, `@unique` and `*Id` names).

Conventions (observed in the schema): money is stored as integer minor units; ids are UUIDs; most tables carry `createdAt`/`updatedAt`; soft delete (`deletedAt`) is used on the models marked below; `OrderItem` and `Order.addressSnapshot` copy data at purchase time so later edits never rewrite history.

```mermaid
erDiagram
  Role {
    String id PK
    String name UK
    String label
    Boolean isStaff
    Boolean system
    DateTime createdAt
    DateTime updatedAt
  }
  User {
    String id PK
    String email UK
    String name
    String phone
    String passwordHash
    String roleId FK
    Boolean active
    Int failedLogins
    DateTime lockedUntil
    DateTime lastLoginAt
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  RefreshToken {
    String id PK
    String userId FK
    String familyId FK
    String tokenHash UK
    String audience
    DateTime expiresAt
    DateTime revokedAt
    String replacedById FK
    String userAgent
    DateTime createdAt
  }
  Category {
    String id PK
    String slug UK
    String name
    String description
    String parentId FK
    String imageUrl
    Int sortOrder
    Boolean active
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  Product {
    String id PK
    String slug UK
    String name
    String description
    String brand
    String categoryId FK
    Boolean active
    Boolean featured
    Boolean isDemo
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  ProductVariant {
    String id PK
    String productId FK
    String sku UK
    String name
    Int price
    Int compareAtPrice
    Int stock
    Boolean trackInventory
    Int lowStockAt
    Boolean active
    Int sortOrder
    DateTime createdAt
    DateTime updatedAt
  }
  ProductImage {
    String id PK
    String productId FK
    String url
    String alt
    Int sortOrder
    DateTime createdAt
  }
  StockMovement {
    String id PK
    String variantId FK
    Int delta
    Int balanceAfter
    String reason
    String refType
    String refId FK
    String note
    String actorId FK
    DateTime createdAt
  }
  Offer {
    String id PK
    String title
    String type
    Int value
    DateTime startsAt
    DateTime endsAt
    Boolean active
    DateTime createdAt
    DateTime updatedAt
  }
  Coupon {
    String id PK
    String code UK
    String type
    Int value
    Int minSubtotal
    Int maxUses
    Int usedCount
    DateTime startsAt
    DateTime endsAt
    Boolean active
    DateTime createdAt
    DateTime updatedAt
  }
  CouponRedemption {
    String id PK
    String couponId FK
    String userId FK
    String orderId UK
    DateTime createdAt
  }
  Banner {
    String id PK
    String title
    String subtitle
    String imageUrl
    String linkUrl
    String placement
    Int sortOrder
    Boolean active
    DateTime startsAt
    DateTime endsAt
    DateTime createdAt
    DateTime updatedAt
  }
  Cart {
    String id PK
    String userId UK
    DateTime updatedAt
  }
  CartItem {
    String id PK
    String cartId FK
    String variantId FK
    Int quantity
    DateTime createdAt
  }
  WishlistItem {
    String id PK
    String userId FK
    String productId FK
    DateTime createdAt
  }
  Address {
    String id PK
    String userId FK
    String label
    String fullName
    String phone
    String line1
    String line2
    String city
    String district
    String province
    String postalCode
    Boolean isDefault
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  Order {
    String id PK
    String number UK
    String userId FK
    String status
    String paymentStatus
    String paymentMethod
    String currency
    Int subtotal
    Int discountTotal
    String couponCode
    Int couponDiscount
    Int shippingFee
    Int taxTotal
    Int total
    Int refundedTotal
    Json addressSnapshot
    String note
    String idempotencyKey
    DateTime placedAt
    DateTime cancelledAt
    DateTime deliveredAt
    DateTime createdAt
    DateTime updatedAt
  }
  OrderItem {
    String id PK
    String orderId FK
    String variantId FK
    String productId FK
    String name
    String variantName
    String sku
    Int unitPrice
    Int listPrice
    Int quantity
    Int lineTotal
  }
  OrderEvent {
    String id PK
    String orderId FK
    String status
    String note
    String actorId FK
    DateTime createdAt
  }
  Payment {
    String id PK
    String orderId FK
    String provider
    Int amount
    String status
    String providerRef
    DateTime verifiedAt
    DateTime createdAt
    DateTime updatedAt
  }
  Shipment {
    String id PK
    String orderId FK
    String carrier
    String trackingNumber
    String status
    DateTime shippedAt
    DateTime deliveredAt
  }
  ReturnRequest {
    String id PK
    String orderId FK
    String userId FK
    String reason
    String status
    String adminNote
    DateTime createdAt
    DateTime updatedAt
  }
  ReturnItem {
    String id PK
    String returnId FK
    String orderItemId FK
    Int quantity
  }
  Refund {
    String id PK
    String orderId FK
    String paymentId FK
    String returnId FK
    Int amount
    String reason
    String actorId FK
    Boolean restock
    DateTime createdAt
  }
  Notification {
    String id PK
    String userId FK
    String audience
    String type
    String title
    String body
    Json data
    DateTime readAt
    DateTime createdAt
  }
  SupportTicket {
    String id PK
    String number UK
    String userId FK
    String subject
    String status
    String priority
    String orderId FK
    String assigneeId FK
    DateTime createdAt
    DateTime updatedAt
  }
  TicketMessage {
    String id PK
    String ticketId FK
    String authorId FK
    Boolean isStaff
    Boolean internal
    String body
    DateTime createdAt
  }
  Setting {
    String key PK
    Json value
    Boolean isPublic
    DateTime updatedAt
  }
  AuditLog {
    String id PK
    String actorId FK
    String actorEmail
    String action
    String entity
    String entityId FK
    Json before
    Json after
    String ip
    DateTime createdAt
  }
  OrderCounter {
    Int id PK
    Int value
  }
  User ||--o{ Address : "user"
  User ||--o{ Cart : "user"
  Cart ||--o{ CartItem : "cart"
  ProductVariant ||--o{ CartItem : "variant"
  Category ||--o{ Category : "parent"
  Coupon ||--o{ CouponRedemption : "coupon"
  User ||--o{ Notification : "user"
  User ||--o{ Order : "user"
  Order ||--o{ OrderEvent : "order"
  Order ||--o{ OrderItem : "order"
  ProductVariant ||--o{ OrderItem : "variant"
  Order ||--o{ Payment : "order"
  Category ||--o{ Product : "category"
  Product ||--o{ ProductImage : "product"
  Product ||--o{ ProductVariant : "product"
  User ||--o{ RefreshToken : "user"
  Order ||--o{ Refund : "order"
  Payment ||--o{ Refund : "payment"
  ReturnRequest ||--o{ Refund : "return"
  OrderItem ||--o{ ReturnItem : "orderItem"
  ReturnRequest ||--o{ ReturnItem : "return"
  Order ||--o{ ReturnRequest : "order"
  User ||--o{ ReturnRequest : "user"
  Order ||--o{ Shipment : "order"
  ProductVariant ||--o{ StockMovement : "variant"
  User ||--o{ SupportTicket : "user"
  SupportTicket ||--o{ TicketMessage : "ticket"
  Role ||--o{ User : "role"
  Product ||--o{ WishlistItem : "product"
  User ||--o{ WishlistItem : "user"
```

## Enums
- **OfferType**: percent, fixed
- **OrderStatus**: pending_payment, placed, confirmed, packed, shipped, out_for_delivery, delivered, cancelled, return_requested, returned, refunded
- **PaymentMethod**: cod, esewa, khalti, stripe
- **PaymentStatus**: unpaid, pending, paid, failed, partially_refunded, refunded
- **ReturnStatus**: requested, approved, rejected, received, refunded
- **StockReason**: initial, sale, cancel_restock, return_restock, adjustment, correction
- **TicketPriority**: low, normal, high, urgent
- **TicketStatus**: open, pending, resolved, closed

## Table notes
| Model | Purpose | Soft delete | Unique constraints | Indexes |
|---|---|---|---|---|
| Role | Named permission sets; permissions is a string array, "*" = all (super_admin). | no | - | - |
| User | Staff and customers in one table (role FK); argon2id hash, failed-login counter + lockedUntil, soft delete. | yes | - | (roleId); (createdAt) |
| RefreshToken | Opaque refresh tokens stored hashed; rotation chain used for reuse detection. | no | - | (userId); (familyId) |
| Category | Product categories (tree-capable). | yes | - | (parentId) |
| Product | Catalogue item; soft delete; slug unique. | yes | - | (categoryId); (active, deletedAt); (name) |
| ProductVariant | Sellable SKU with price and stock (stock is changed only by guarded UPDATEs). | no | - | (productId); (stock) |
| ProductImage | Image URLs for a product (files served by the storage driver). | no | - | (productId) |
| StockMovement | Append-only stock ledger: delta, balanceAfter, reason, ref to order. | no | - | (variantId, createdAt) |
| Offer | Time-boxed percent/fixed discounts on products or categories. | no | - | (startsAt, endsAt) |
| Coupon | Code-based discount with min subtotal, max uses and usedCount. | no | - | - |
| CouponRedemption | Which order used which coupon. | no | (couponId, userId, orderId) | (couponId, userId) |
| Banner | Homepage/app banners with schedule. | no | - | (placement, active) |
| Cart | One cart per customer. | no | - | - |
| CartItem | Variant + quantity in a cart. | no | (cartId, variantId) | - |
| WishlistItem | Customer wishlist entry. | no | (userId, productId) | - |
| Address | Customer address book; soft delete. | yes | - | (userId) |
| Order | Placed order; unique (userId, idempotencyKey); totals stored in minor units; addressSnapshot JSON. | no | (userId, idempotencyKey) | (userId, createdAt); (status, createdAt) |
| OrderItem | Line snapshot (name, unit price) at purchase time. | no | - | (orderId) |
| OrderEvent | Status timeline (powers tracking). | no | - | (orderId, createdAt) |
| Payment | Payment attempt/record per order and method; verifiedAt set only server-side. | no | - | (orderId) |
| Shipment | Carrier, tracking number, shipped/delivered timestamps. | no | - | (orderId) |
| ReturnRequest | Customer return request with admin decision. | no | - | (orderId); (userId) |
| ReturnItem | Items/quantities in a return. | no | - | - |
| Refund | Recorded refund amount per order/return. | no | - | (orderId) |
| Notification | In-app notifications per user. | no | - | (userId, createdAt); (audience, createdAt) |
| SupportTicket | Customer support ticket. | no | - | (userId); (status) |
| TicketMessage | Messages on a ticket (staff or customer). | no | - | (ticketId, createdAt) |
| Setting | Key/value app configuration; isPublic marks keys exposed by /catalog/config. | no | - | - |
| AuditLog | Who did what, entity, IP, metadata. | no | - | (entity, entityId); (actorId, createdAt); (createdAt) |
| OrderCounter | Single-row counter used to generate order numbers. | no | - | - |

## Invariants enforced in code (see ARCHITECTURE.md)
- `ProductVariant.stock` changes only through guarded SQL (`UPDATE ... WHERE stock >= qty`) inside a transaction and always writes a `StockMovement` row with `balanceAfter`.
- `Order(userId, idempotencyKey)` is unique, so a double-submitted checkout returns the first order.
- Order status moves only along the transitions in `packages/shared/src/orders.ts`; each move is claimed with `updateMany({ where: { id, status: previous } })` so two concurrent writers cannot both win.
- Not enforced by the database: row-level security (not used in S Mart; isolation is by ownership checks in the API, see SECURITY.md).
