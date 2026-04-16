export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'customer' | 'vendor' | 'delivery' | 'admin';
  phone: string;
  avatar: string | null;
  country?: string;
  is_verified: boolean;
  is_active: boolean;
  is_superuser?: boolean;
  force_password_change?: boolean;
}

export interface AuthResponse {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

export interface Address {
  id: string;
  label: 'home' | 'work' | 'other';
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

export interface Vendor {
  id: string;
  store_name: string;
  description: string;
  logo: string | null;
  banner: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  status: string;
  is_open: boolean;
  opening_time: string;
  closing_time: string;
  min_order_amount: number;
  delivery_radius_km: number;
  average_rating: number;
  total_ratings: number;
  is_featured: boolean;
  distance_km?: number;
  products?: Product[];
  vendor_tier?: string;
  user_info?: User;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  parent: string | null;
  parent_name: string | null;
  children: Category[];
  subcategory_count: number;
  is_active: boolean;
  show_in_customer_ui: boolean;
  display_order: number;
}

export interface ProductImage {
  id: string;
  image: string;
  is_primary: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_price: number | null;
  sku: string;
  stock: number;
  low_stock_threshold: number;
  unit: string;
  weight: string;
  is_available: boolean;
  is_featured: boolean;
  average_rating: number;
  total_ratings: number;
  discount_percentage: number;
  in_stock: boolean;
  images: ProductImage[];
  primary_image: string | null;
  vendor: Vendor;
  vendor_name: string;
  category: Category;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  subtotal: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total_items: number;
  total_amount: number;
}

export interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderTracking {
  id: string;
  status: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
}

export interface VendorInfo {
  id: string;
  store_name: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  phone: string;
}

export interface DeliveryPartnerInfo {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  average_rating: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  vendor_name: string;
  vendor: string;
  vendor_info: VendorInfo;
  status: string;
  payment_method: string;
  is_payment_verified: boolean;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  notes: string;
  pickup_otp?: string;
  delivery_otp?: string;
  delivery_photo?: string | null;
  estimated_delivery_time: number | null;
  actual_delivery_time: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  items: OrderItem[];
  tracking: OrderTracking[];
  delivery_address: Address;
  delivery_partner?: string | null;
  delivery_partner_info?: DeliveryPartnerInfo | null;
  assignment_status?: string | null;
  refund_status?: 'none' | 'initiated' | 'processed' | 'failed' | null;
  placed_at: string;
  distance_km?: number;
}

export interface AssignmentOrderItem {
  name: string;
  quantity: number;
  price: string;
}

export interface DeliveryAssignment {
  id: string;
  status: string;
  current_radius_km: number;
  order: string;
  order_number: string;
  vendor_name: string;
  vendor_lat: string;
  vendor_lng: string;
  vendor_address: string;
  order_total: string;
  order_items: AssignmentOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface PaymentQR {
  order_number: string;
  amount: string;
  qr_base64: string;
  upi_string: string;
}

export interface DeliveryPartner {
  id: string;
  user_info: User;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  is_approved: boolean;
  is_available: boolean;
  status: string;
  current_latitude: number | null;
  current_longitude: number | null;
  average_rating: number;
  total_deliveries: number;
  total_earnings: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  data: any;
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Asset {
  id: string;
  name: string;
  asset_type: string;
  serial_number: string;
  description: string;
  status: 'active' | 'inactive' | 'maintenance' | 'retired';
  assigned_to: string | null;
  assigned_to_name: string | null;
  purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_orders: number;
  total_products: number;
  average_rating: number;
  total_ratings: number;
  recent_orders: Order[];
  is_open: boolean;
  closing_time: string | null;
  require_stock_check: boolean;
  low_stock_count: number;
  low_stock_products: Product[];
}

export interface DeliveryDashboard {
  total_deliveries: number;
  total_earnings: string;
  average_rating: string;
  active_orders: Order[];
  partner_status: 'available' | 'offline' | 'on_delivery';
}


