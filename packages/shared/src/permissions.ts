export const PERMISSIONS = [
  'dashboard.view','analytics.view',
  'products.read','products.write','categories.write',
  'inventory.read','inventory.write',
  'pricing.write','banners.write',
  'orders.read','orders.update','orders.ship','orders.cancel',
  'customers.read','customers.write',
  'payments.read','refunds.write','returns.manage',
  'tickets.read','tickets.manage','notifications.manage',
  'users.manage','roles.manage','settings.write','audit.read','backup.manage',
  'reports.export','uploads.write',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_ROLES = ['super_admin','admin','manager','inventory_staff','support_agent','order_staff','finance'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type RoleName = StaffRole | 'customer';

const without = (xs: readonly Permission[], drop: Permission[]) => xs.filter((x) => !drop.includes(x));

export const ROLE_DEFINITIONS: Record<RoleName, { label: string; isStaff: boolean; permissions: string[] }> = {
  super_admin: { label: 'Super admin', isStaff: true, permissions: ['*'] },
  admin: { label: 'Admin', isStaff: true, permissions: without(PERMISSIONS, ['roles.manage']) },
  manager: { label: 'Manager', isStaff: true, permissions: [
    'dashboard.view','analytics.view','products.read','products.write','categories.write','inventory.read','inventory.write',
    'pricing.write','banners.write','orders.read','orders.update','orders.ship','orders.cancel','customers.read','payments.read',
    'returns.manage','tickets.read','tickets.manage','reports.export','uploads.write'] },
  inventory_staff: { label: 'Inventory staff', isStaff: true, permissions: ['dashboard.view','products.read','inventory.read','inventory.write','uploads.write'] },
  support_agent: { label: 'Support agent', isStaff: true, permissions: ['dashboard.view','orders.read','customers.read','tickets.read','tickets.manage','notifications.manage'] },
  order_staff: { label: 'Order staff', isStaff: true, permissions: ['dashboard.view','orders.read','orders.update','orders.ship','customers.read','returns.manage'] },
  finance: { label: 'Finance', isStaff: true, permissions: ['dashboard.view','analytics.view','orders.read','payments.read','refunds.write','reports.export'] },
  customer: { label: 'Customer', isStaff: false, permissions: [] },
};

export function hasPermission(granted: readonly string[], needed: string): boolean {
  return granted.includes('*') || granted.includes(needed);
}
export function hasAllPermissions(granted: readonly string[], needed: readonly string[]): boolean {
  return needed.every((n) => hasPermission(granted, n));
}
