import { z } from 'zod';

const cuid = z.string().uuid();
export const money = z.number().int().min(0).max(100_000_000_00);
const text = (max: number) => z.string().trim().min(1).max(max);
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const phone = z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, 'invalid phone');

export const registerSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(10).max(200), name: text(120), phone: phone.optional() }).strict();
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200), audience: z.enum(['admin', 'customer']).default('customer') }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(400).optional() }).strict();

export const categorySchema = z.object({ name: text(120), slug: slug.optional(), description: z.string().max(2000).optional(), parentId: cuid.nullable().optional(), imageUrl: z.string().max(500).nullable().optional(), sortOrder: z.number().int().min(0).max(10000).optional(), active: z.boolean().optional() }).strict();
export const variantSchema = z.object({ id: cuid.optional(), sku: text(64), name: z.string().trim().max(120).default('Default'), price: money, compareAtPrice: money.nullable().optional(), stock: z.number().int().min(0).max(1_000_000).default(0), trackInventory: z.boolean().default(true), lowStockAt: z.number().int().min(0).max(100000).default(5), active: z.boolean().default(true) }).strict();
export const productSchema = z.object({ name: text(200), slug: slug.optional(), description: z.string().max(10000).default(''), brand: z.string().trim().max(120).nullable().optional(), categoryId: cuid, active: z.boolean().default(true), featured: z.boolean().default(false), variants: z.array(variantSchema).min(1).max(50), images: z.array(z.object({ url: z.string().max(500), alt: z.string().max(200).default('') }).strict()).max(12).optional() }).strict();
export const productUpdateSchema = productSchema.partial().strict();
export const stockAdjustSchema = z.object({ delta: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, 'delta must not be 0'), note: z.string().max(300).optional() }).strict();

export const offerSchema = z.object({ title: text(120), type: z.enum(['percent', 'fixed']), value: z.number().int().min(1).max(100_000_000), startsAt: z.coerce.date(), endsAt: z.coerce.date(), active: z.boolean().default(true), productIds: z.array(cuid).max(500).default([]), categoryIds: z.array(cuid).max(100).default([]) }).strict()
  .refine((o) => o.endsAt > o.startsAt, { message: 'endsAt must be after startsAt', path: ['endsAt'] })
  .refine((o) => o.type !== 'percent' || o.value <= 90, { message: 'percent offers are capped at 90', path: ['value'] });
export const couponSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/), type: z.enum(['percent', 'fixed']), value: z.number().int().min(1).max(100_000_000), minSubtotal: money.default(0), maxUses: z.number().int().min(1).nullable().optional(), startsAt: z.coerce.date().nullable().optional(), endsAt: z.coerce.date().nullable().optional(), active: z.boolean().default(true) }).strict()
  .refine((c) => c.type !== 'percent' || c.value <= 90, { message: 'percent coupons are capped at 90', path: ['value'] });
export const bannerSchema = z.object({ title: text(160), subtitle: z.string().max(300).nullable().optional(), imageUrl: z.string().max(500).nullable().optional(), linkUrl: z.string().max(500).nullable().optional(), placement: z.enum(['home_hero', 'home_strip', 'category']).default('home_hero'), sortOrder: z.number().int().min(0).max(1000).default(0), active: z.boolean().default(true), startsAt: z.coerce.date().nullable().optional(), endsAt: z.coerce.date().nullable().optional() }).strict();

export const cartAddSchema = z.object({ variantId: cuid, quantity: z.number().int().min(1).max(99) }).strict();
export const cartSetSchema = z.object({ quantity: z.number().int().min(0).max(99) }).strict();
export const addressSchema = z.object({ label: z.string().trim().max(40).default('Home'), fullName: text(120), phone, line1: text(200), line2: z.string().trim().max(200).nullable().optional(), city: text(80), district: z.string().trim().max(80).nullable().optional(), province: z.string().trim().max(80).nullable().optional(), postalCode: z.string().trim().max(20).nullable().optional(), isDefault: z.boolean().default(false) }).strict();
export const checkoutSchema = z.object({ addressId: cuid, paymentMethod: z.enum(['cod', 'esewa', 'khalti', 'stripe']).default('cod'), couponCode: z.string().trim().toUpperCase().max(32).optional(), note: z.string().trim().max(500).optional() }).strict();
export const orderStatusSchema = z.object({ status: z.enum(['confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled']), note: z.string().max(500).optional() }).strict();
export const shipSchema = z.object({ carrier: text(80), trackingNumber: z.string().trim().max(80).optional(), note: z.string().max(500).optional() }).strict();
export const cancelSchema = z.object({ reason: z.string().trim().max(500).optional() }).strict();
export const returnSchema = z.object({ reason: text(1000), items: z.array(z.object({ orderItemId: cuid, quantity: z.number().int().min(1).max(99) }).strict()).min(1).max(50) }).strict();
export const returnDecisionSchema = z.object({ decision: z.enum(['approve', 'reject', 'received']), adminNote: z.string().max(500).optional() }).strict();
export const refundSchema = z.object({ amount: money.min(1), reason: text(500), restock: z.boolean().default(false), returnId: cuid.optional() }).strict();
export const ticketCreateSchema = z.object({ subject: text(200), body: text(5000), orderId: cuid.optional(), priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal') }).strict();
export const ticketMessageSchema = z.object({ body: text(5000), internal: z.boolean().optional() }).strict();
export const ticketUpdateSchema = z.object({ status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(), priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(), assigneeId: cuid.nullable().optional() }).strict();
export const profileSchema = z.object({ name: text(120).optional(), phone: phone.nullable().optional() }).strict();
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(10).max(200) }).strict();
export const staffUserSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), name: text(120), password: z.string().min(10).max(200), roleId: cuid, phone: phone.optional(), active: z.boolean().default(true) }).strict();
export const staffUserUpdateSchema = z.object({ name: text(120).optional(), roleId: cuid.optional(), active: z.boolean().optional(), password: z.string().min(10).max(200).optional() }).strict();
export const roleSchema = z.object({ name: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,30}$/), label: text(60), permissions: z.array(z.string().max(40)).max(60) }).strict();
export const settingsSchema = z.record(z.string().max(60), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]));
export const SETTING_DEFAULTS: Record<string, { value: string | number | boolean | null; isPublic: boolean }> = {
  storeName: { value: 'S Mart', isPublic: true },
  currency: { value: 'NPR', isPublic: true },
  supportEmail: { value: '', isPublic: true },
  supportPhone: { value: '', isPublic: true },
  shippingFlat: { value: 15000, isPublic: true },
  freeShippingOver: { value: 200000, isPublic: true },
  taxBps: { value: 0, isPublic: true },
  returnWindowDays: { value: 7, isPublic: true },
  codEnabled: { value: true, isPublic: true },
  maintenanceMode: { value: false, isPublic: true },
  announcement: { value: '', isPublic: true },
};
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
