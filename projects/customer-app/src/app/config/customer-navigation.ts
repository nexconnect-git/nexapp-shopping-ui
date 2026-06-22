export interface CustomerNavItem {
  icon: string;
  label: string;
  route: string;
  featureRoute?: string;
  exact?: boolean;
  badge?: boolean;
}

export const CUSTOMER_MOBILE_NAV_ITEMS: CustomerNavItem[] = [
  { icon: 'home', label: 'Home', route: '/', exact: true },
  {
    icon: 'storefront',
    label: 'Stores',
    route: '/stores',
    featureRoute: '/explore',
  },
  {
    icon: 'search',
    label: 'Search',
    route: '/search',
    featureRoute: '/search',
  },
  { icon: 'shopping_bag', label: 'Cart', route: '/cart', badge: true },
  {
    icon: 'person',
    label: 'Account',
    route: '/account',
    featureRoute: '/account',
  },
];
