export interface DeliveryNavItem {
  label: string;
  mobileLabel?: string;
  icon: string;
  route: string;
  exact?: boolean;
}

export const DELIVERY_NAV_ITEMS: DeliveryNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/', exact: true },
  {
    label: 'Available Orders',
    mobileLabel: 'Available',
    icon: 'local_shipping',
    route: '/available',
  },
  {
    label: 'Active Delivery',
    mobileLabel: 'Active',
    icon: 'delivery_dining',
    route: '/active',
  },
  { label: 'History', icon: 'history', route: '/history' },
  { label: 'Earnings', icon: 'payments', route: '/earnings' },
  { label: 'Profile', icon: 'person', route: '/profile' },
];
