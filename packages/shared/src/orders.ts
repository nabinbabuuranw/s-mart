export const ORDER_STATUSES = ['pending_payment','placed','confirmed','packed','shipped','out_for_delivery','delivered','cancelled','return_requested','returned','refunded'] as const;
export type OrderStatusT = (typeof ORDER_STATUSES)[number];

const T: Record<OrderStatusT, OrderStatusT[]> = {
  pending_payment: ['placed', 'cancelled'],
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['returned', 'delivered'],
  returned: ['refunded'],
  cancelled: [],
  refunded: [],
};
export const canTransition = (from: OrderStatusT, to: OrderStatusT) => T[from]?.includes(to) ?? false;
export const nextStatuses = (from: OrderStatusT) => T[from] ?? [];
/** Customers may cancel only before the parcel is packed. */
export const customerCanCancel = (s: OrderStatusT) => s === 'placed' || s === 'confirmed' || s === 'pending_payment';
export function withinReturnWindow(deliveredAt: Date | null, days: number, now = new Date()): boolean {
  if (!deliveredAt) return false;
  return now.getTime() - deliveredAt.getTime() <= days * 86400000;
}
/** Statuses that admins set manually through the status endpoint (shipping uses its own endpoint). */
export const ADMIN_SETTABLE: OrderStatusT[] = ['confirmed','packed','out_for_delivery','delivered','cancelled'];
