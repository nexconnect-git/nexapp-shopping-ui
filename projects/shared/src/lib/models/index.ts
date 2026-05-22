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

export interface MobileOtpRequestResponse {
  detail: string;
  phone: string;
  user_exists?: boolean;
  dev_otp?: string;
}

export interface Address {
  id: string;
  label: 'home' | 'work' | 'other';
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  landmark?: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

export interface SelectedLocation {
  lat: number;
  lng: number;
  name: string;
  city?: string;
  state?: string;
  postalCode?: string;
  source?: 'gps' | 'manual' | 'saved_address';
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
  is_open_now?: boolean;
  availability_note?: string;
  opening_time: string;
  closing_time: string;
  min_order_amount: number;
  delivery_radius_km: number;
  average_rating: number;
  total_ratings: number;
  is_featured: boolean;
  distance_km?: number;
  estimated_delivery_minutes?: number;
  estimated_delivery_label?: string;
  far_order_eta_label?: string;
  vehicle_type?: string;
  vehicle_reason?: string;
  is_far_delivery?: boolean;
  requires_far_delivery_confirmation?: boolean;
  within_instant_radius?: boolean;
  same_state?: boolean;
  is_serviceable?: boolean;
  serviceability_error?: string;
  matched_products_preview?: string[];
  has_previously_ordered?: boolean;
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
  icon_name: string;
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
  catalog_product?: CatalogProduct | null;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_price: number | null;
  tax_rate?: number;
  brand?: string;
  sku: string;
  stock: number;
  low_stock_threshold: number;
  min_order_quantity?: number;
  unit: string;
  weight: string;
  is_available: boolean;
  prep_time_minutes?: number;
  is_instant_delivery?: boolean;
  is_scheduled_delivery?: boolean;
  is_perishable?: boolean;
  requires_cold_storage?: boolean;
  is_fragile?: boolean;
  is_age_restricted?: boolean;
  allow_customer_notes?: boolean;
  is_returnable?: boolean;
  packaging_instructions?: string;
  search_keywords?: string;
  ingredients?: string;
  allergens?: string;
  shelf_life?: string;
  barcode?: string;
  compliance_notes?: string;
  is_featured: boolean;
  status?: string;
  average_rating: number;
  total_ratings: number;
  discount_percentage: number;
  in_stock: boolean;
  images: ProductImage[];
  primary_image: string | null;
  vendor: Vendor;
  vendor_name: string;
  category: Category;
  image_count?: number;
  visibility_status?: 'ready_to_sell' | 'needs_attention';
  visibility_blockers?: string[];
  category_visibility?: 'customer_visible' | 'pending_review' | 'missing';
  sales_count?: number;
  revenue?: number;
  inheritance_mode?: 'base_image' | 'vendor_image_only' | 'mixed';
  approval_status?: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  approval_status_label?: string;
  rejection_reason?: string;
  reviewed_at?: string | null;
  approval_requested_at?: string | null;
  approval_change_summary?: string[];
  requires_admin_review?: boolean;
  submission_batch_id?: string | null;
}

export interface CatalogProductImage {
  id: string;
  image: string;
  is_primary: boolean;
  display_order?: number;
}

export interface CatalogProduct {
  id: string;
  category: Category | null;
  name: string;
  slug: string;
  description: string;
  brand: string;
  unit: string;
  barcode: string;
  search_keywords: string;
  compliance_notes: string;
  is_active: boolean;
  images: CatalogProductImage[];
  created_at: string;
  updated_at: string;
}

export interface VendorCatalogGrant {
  id: string;
  vendor: string;
  vendor_name: string;
  catalog_product: CatalogProduct;
  granted_at: string;
}

export interface CatalogProposalItem {
  id: string;
  name: string;
  category: Category | null;
  description: string;
  brand: string;
  unit: string;
  barcode: string;
  sku_hint: string;
  status: 'pending' | 'approved' | 'rejected';
  created_catalog_product: CatalogProduct | null;
  rejection_reason: string;
  reviewed_at: string | null;
}

export interface CatalogProposal {
  id: string;
  vendor: string;
  vendor_name: string;
  status: 'pending' | 'partially_approved' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string;
  items: CatalogProposalItem[];
}

export interface VariantSubmissionBatch {
  batch_id: string;
  variants: Product[];
}

export interface VendorAnalytics {
  period_label: string;
  total_revenue: number;
  total_orders: number;
  delivered_orders: number;
  average_order_value: number;
  repeat_customers: number;
  top_products: Array<{
    product_id: string;
    name: string;
    total_sold: number;
    revenue: number;
  }>;
  monthly_data: Array<{ month: string; revenue: number; orders: number }>;
  payout_summary: Array<{ status: string; count: number; amount: number }>;
  coupon_contribution: {
    usage_count: number;
    discount: number;
    revenue: number;
  };
  low_stock_impact: { low_stock_count: number };
}

export interface VendorOperationsSummary {
  store: {
    is_open: boolean;
    is_accepting_orders: boolean;
    auto_order_acceptance: boolean;
    closing_time: string | null;
  };
  today: {
    revenue: number;
    orders: number;
    delivered_orders: number;
  };
  orders: {
    new: number;
    confirmed: number;
    preparing: number;
    ready: number;
    picked_up: number;
    on_the_way: number;
    active_total: number;
  };
  delivery: {
    searching: number;
    assigned: number;
    timed_out: number;
  };
  alerts: {
    low_stock: number;
    product_attention: number;
    pending_payouts: number;
    support_open: number;
    unread_notifications: number;
  };
  updated_at: string;
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
  product?: string | null;
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
  has_rating?: boolean;
  total_items?: number;
  total_amount?: number;
  delivery_tip?: string | null;
}

export interface DeliveryFeeQuote {
  vendor_id: string;
  vendor_name: string;
  vendor_state?: string;
  address_state?: string;
  distance_km: number;
  estimated_delivery_minutes: number;
  estimated_delivery_label: string;
  far_order_eta_label: string;
  delivery_fee: string;
  vehicle_type: string;
  vehicle_reason: string;
  is_far_delivery: boolean;
  requires_far_delivery_confirmation: boolean;
  within_instant_radius: boolean;
  same_state: boolean;
  is_serviceable: boolean;
  serviceability_error: string;
  max_supported_distance_km: number;
  instant_radius_km: number;
  reason?: string;
}

export interface DeliveryFeePreview {
  fees: DeliveryFeeQuote[];
  total_delivery_fee: string;
  requires_far_delivery_confirmation: boolean;
  far_delivery_quotes: DeliveryFeeQuote[];
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
