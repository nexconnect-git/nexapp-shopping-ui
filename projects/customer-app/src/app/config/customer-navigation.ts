export interface CustomerNavItem {
  icon: string;
  label: string;
  route: string;
  featureRoute?: string;
  exact?: boolean;
  badge?: boolean;
  activeRoutes?: string[];
}

export const CUSTOMER_MOBILE_NAV_ITEMS: CustomerNavItem[] = [
  { icon: 'home', label: 'Home', route: '/', exact: true },
  {
    icon: 'storefront',
    label: 'Stores',
    route: '/stores',
    featureRoute: '/explore',
    activeRoutes: ['/stores', '/store'],
  },
  {
    icon: 'search',
    label: 'Search',
    route: '/explore',
    featureRoute: '/explore',
  },
  { icon: 'shopping_bag', label: 'Cart', route: '/cart', badge: true, activeRoutes: ['/cart', '/checkout'] },
  {
    icon: 'person',
    label: 'Account',
    route: '/account',
    featureRoute: '/account',
    activeRoutes: ['/account', '/orders', '/order-confirmed', '/tracking', '/order-finished', '/addresses', '/notifications', '/privacy-policy', '/help', '/issues'],
  },
];
