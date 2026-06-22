export interface VendorNavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
}

export interface VendorNavGroup {
  label: string;
  items: VendorNavItem[];
}

export const VENDOR_NAV_GROUPS: VendorNavGroup[] = [
  {
    label: 'Operate',
    items: [
      { label: 'Dashboard', icon: 'space_dashboard', route: '/', exact: true },
      { label: 'Live Orders', icon: 'view_kanban', route: '/live-orders' },
      { label: 'Inventory', icon: 'inventory', route: '/inventory' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', icon: 'inventory_2', route: '/products' },
      {
        label: 'Catalog Requests',
        icon: 'playlist_add',
        route: '/catalog-requests',
      },
      { label: 'Orders', icon: 'receipt_long', route: '/orders' },
      {
        label: 'Promotions',
        icon: 'confirmation_number',
        route: '/promotions',
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'Analytics', icon: 'monitoring', route: '/analytics' },
      { label: 'Payouts', icon: 'payments', route: '/payouts' },
      { label: 'Reviews', icon: 'reviews', route: '/reviews' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Support', icon: 'support_agent', route: '/support' },
      {
        label: 'Notifications',
        icon: 'notifications',
        route: '/notifications',
      },
      {
        label: 'Store Settings',
        icon: 'manage_accounts',
        route: '/store-settings',
      },
    ],
  },
];

export const VENDOR_MOBILE_NAV_ITEMS: VendorNavItem[] = [
  { label: 'Home', icon: 'space_dashboard', route: '/', exact: true },
  { label: 'Orders', icon: 'view_kanban', route: '/live-orders' },
  { label: 'Stock', icon: 'inventory', route: '/inventory' },
  { label: 'Inbox', icon: 'notifications', route: '/notifications' },
  { label: 'Store', icon: 'settings', route: '/store-settings' },
];
