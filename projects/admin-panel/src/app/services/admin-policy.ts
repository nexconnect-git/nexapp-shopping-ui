import { ADMIN_BASE_NAV_SECTIONS } from '../config/admin-navigation';

export function firstAccessibleAdminRoute(canRoute: (route: string) => boolean): string {
  return ADMIN_BASE_NAV_SECTIONS.flatMap(section => section.items).find(item => canRoute(item.route))?.route ?? '/admin/profile';
}

export function permissionForRoute(url: string): string | null {
  const path = url.split('?')[0].replace(/^\//, '');
  if (
    [
      'admin/profile',
      'admin/profile/edit',
      'admin/profile/review',
      'change-password',
      'access-denied',
    ].includes(path)
  )
    return null;
  const first = path.split('/')[0];
  const domain: Record<string, string> = {
    '': 'overview',
    orders: 'orders',
    dispatch: 'dispatch',
    'fulfillment-ops': 'dispatch',
    'delivery-partners': 'dispatch',
    assets: 'dispatch',
    vendors: 'vendors',
    customers: 'customers',
    products: 'catalog',
    catalog: 'catalog',
    'catalog-requests': 'catalog',
    'vendor-variant-approvals': 'catalog',
    categories: 'catalog',
    issues: 'support',
    payments: 'finance',
    payouts: 'finance',
    reconciliation: 'finance',
    coupons: 'growth',
    banners: 'growth',
    'customer-content': 'growth',
    notifications: 'notifications',
    'scheduled-tasks': 'automation',
    'platform-settings': 'settings',
    settings: 'settings',
    'production-readiness': 'settings',
    'audit-logs': 'audit',
  };
  if (first === 'permissions' || first === 'admin-users') return 'superuser';
  return domain[first]
    ? `${domain[first]}.${/\/(edit|onboard)$/.test(path) ? 'manage' : 'view'}`
    : 'settings.view';
}
