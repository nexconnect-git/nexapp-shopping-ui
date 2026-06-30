export interface AdminNavItem {
  route: string;
  icon: string;
  label: string;
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_QUICK_LINKS: AdminNavItem[] = [
  { route: '/orders', icon: 'receipt_long', label: 'Orders' },
  { route: '/dispatch', icon: 'route', label: 'Dispatch' },
  { route: '/vendors/onboard', icon: 'storefront', label: 'Vendor' },
];

export const ADMIN_BASE_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: 'Operate',
    items: [
      { route: '/', icon: 'speed', label: 'Command Center' },
      { route: '/orders', icon: 'receipt_long', label: 'Live Orders' },
      { route: '/dispatch', icon: 'route', label: 'Dispatch Board' },
      {
        route: '/fulfillment-ops',
        icon: 'warehouse',
        label: 'Fulfillment Ops',
      },
      {
        route: '/delivery-partners',
        icon: 'two_wheeler',
        label: 'Dispatch Fleet',
      },
      { route: '/issues', icon: 'support_agent', label: 'Exceptions' },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { route: '/vendors', icon: 'storefront', label: 'Stores' },
      { route: '/catalog', icon: 'inventory_2', label: 'Master Catalog' },
      {
        route: '/catalog-requests',
        icon: 'playlist_add_check',
        label: 'Catalog Requests',
      },
      {
        route: '/vendor-variant-approvals',
        icon: 'rule',
        label: 'Product Approvals',
      },
      { route: '/products', icon: 'store', label: 'Vendor Products' },
      { route: '/categories', icon: 'category', label: 'Categories' },
      { route: '/customers', icon: 'groups', label: 'Customers' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { route: '/coupons', icon: 'local_activity', label: 'Promotions' },
      { route: '/banners', icon: 'view_carousel', label: 'Home Banners' },
      {
        route: '/customer-content',
        icon: 'dashboard_customize',
        label: 'Customer Templates',
      },
      { route: '/notifications', icon: 'campaign', label: 'Notifications' },
      { route: '/assets', icon: 'handyman', label: 'Assets' },
    ],
  },
  {
    label: 'Money',
    items: [
      { route: '/payments', icon: 'credit_card', label: 'Payments' },
      { route: '/payouts', icon: 'account_balance_wallet', label: 'Payouts' },
      {
        route: '/reconciliation',
        icon: 'fact_check',
        label: 'Reconciliation',
      },
      {
        route: '/scheduled-tasks',
        icon: 'event_repeat',
        label: 'Automation',
      },
    ],
  },
];

export const ADMIN_GOVERN_NAV_ITEMS: AdminNavItem[] = [
  { route: '/platform-settings', icon: 'tune', label: 'Platform Settings' },
  {
    route: '/settings/page-feature-management',
    icon: 'toggle_on',
    label: 'Page & Feature Mgmt',
  },
  { route: '/audit-logs', icon: 'manage_search', label: 'Audit Logs' },
  { route: '/production-readiness', icon: 'verified', label: 'Readiness' },
];
