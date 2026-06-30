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

export interface CustomerServiceability {
  is_serviceable: boolean;
  message: string;
  nearby_store_count: number;
  instant_store_count: number;
  eta_label: string;
  nearest_store_eta?: number | null;
  nearest_store?: any;
  fulfillment_node?: {
    id: string;
    type: string;
    name: string;
    vendor_id?: string;
    distance_km?: number | null;
    is_instant?: boolean;
    is_accepting_orders?: boolean;
    coverage_radius_km?: number | null;
  } | null;
  promise?: {
    id: string;
    fulfillment_node_id: string;
    eta_min_minutes?: number | null;
    eta_max_minutes?: number | null;
    eta_label: string;
    delivery_fee?: string | number | null;
    distance_km?: number | null;
    vehicle_type?: string;
    expires_at?: string;
    requires_confirmation?: boolean;
    is_instant?: boolean;
  } | null;
  availability_summary?: {
    available_product_count: number;
    available_store_count: number;
    instant_store_count: number;
  };
}

export interface ActiveOrderSummary {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  eta_label: string;
  store?: any;
  delivery_address?: any;
  total: string;
  can_track: boolean;
  can_cancel: boolean;
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

export interface CustomerHomeHero {
  title: string;
  subtitle: string;
  badge: string;
  cta_label: string;
  cta_url: string;
  image: string;
  store?: unknown;
  coupon?: unknown;
}

export interface CustomerHomeSection<T = unknown> {
  key: string;
  title: string;
  layout: 'category_grid' | 'store_rail' | 'product_rail' | 'product_grid' | 'coupon_rail' | string;
  items: T[];
  count: number;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  memberSince: string;
  ordersDelivered: number;
  prime: boolean;
}
