import type {
  Address as ApiAddress,
  CartItem as ApiCartItem,
  Category as ApiCategory,
  Order as ApiOrder,
  Product as ApiProduct,
  Vendor as ApiVendor,
} from '@shared/lib/models';

export type BadgeTone = 'green' | 'red' | 'purple' | 'orange' | 'blue';

export interface Category {
  id: string;
  label: string;
  icon: string;
  image?: string;
  bg: string;
  raw?: ApiCategory;
}

export interface Store {
  id: string;
  name: string;
  category: string;
  rating: number;
  ratings: string;
  eta: string;
  distance: string;
  offer: string;
  delivery: string;
  image: string;
  hero: string;
  tags: string[];
  isExpress?: boolean;
  raw?: ApiVendor;
}

export interface Product {
  id: string;
  apiId?: string;
  cartItemId?: string;
  name: string;
  unit: string;
  price: number;
  mrp: number;
  discount: string;
  image: string;
  category: string;
  rating: number;
  storeId: string;
  storeName?: string;
  highlights?: string[];
  raw?: ApiProduct;
}

export interface CartItem extends Product {
  quantity: number;
  subtotal?: number;
  rawCartItem?: ApiCartItem;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  line: string;
  phone: string;
  isDefault?: boolean;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  latitude?: number | null;
  longitude?: number | null;
  raw?: ApiAddress;
}

export interface PaymentMethod {
  id: string;
  label: string;
  description: string;
  icon: string;
  isDefault?: boolean;
}

export interface Order {
  id: string;
  date: string;
  time: string;
  amount: number;
  items: Product[];
  status: 'Active' | 'Delivered' | 'Cancelled';
  payment: string;
  raw?: ApiOrder;
}

export interface Offer {
  code: string;
  title: string;
  description: string;
  valid: string;
  tone: BadgeTone;
}

export interface PlatformBanner {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  ctaLabel: string;
  ctaUrl: string;
  image: string | null;
  bgGradient: string;
  raw?: any;
}

export interface CustomerCoupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  badgeText: string;
  iconName: string;
  accentColor: string;
  validUntil: string | null;
  raw?: any;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  memberSince: string;
  ordersDelivered: number;
  prime: boolean;
}
