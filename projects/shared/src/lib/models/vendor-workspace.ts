import {
  CatalogProduct,
  Notification,
  Order,
  PaginatedResponse,
  Product,
  Vendor,
} from './index';

export type VendorMoney = string | number;
export interface VendorInventorySummary {
  total: number;
  low: number;
  out: number;
  paused: number;
  missing_photo: number;
  category_pending: number;
  ready: number;
  updated_at: string | null;
}
export interface VendorWorkspace {
  vendor: Vendor & {
    wallet_balance: VendorMoney;
    status_reason: string;
    require_stock_check: boolean;
    auto_order_acceptance: boolean;
    user_info: { id: string; force_password_change: boolean; country: string };
  };
  operating: {
    is_open: boolean;
    is_accepting_orders: boolean;
    is_open_now: boolean;
    is_within_hours?: boolean;
    availability_note: string;
    effective_status?: { code: string; label: string; reason: string };
  };
  readiness: {
    blockers: { code: string; message: string; route: string }[];
    can_open: boolean;
    can_enable_intake: boolean;
    stock_review_required: boolean;
    stock_review_current: boolean;
  };
  inventory: VendorInventorySummary;
  verification: {
    bank: {
      configured: boolean;
      verified: boolean;
      bank_name: string;
      masked_account: string;
    };
    kyc_status: string;
    onboarding_status: string;
    documents: Record<string, number>;
  };
  allowed_actions: {
    operate: boolean;
    correct_details: boolean;
    upload_documents: boolean;
    contact: boolean;
  };
  timezone: string;
  updated_at: string;
}
export interface VendorBulkStockResult {
  updated: string[];
  errors: {
    id: string | null;
    index: number;
    field: string;
    message: string;
    current_stock?: number;
  }[];
}
export type VendorOrderCommand =
  | 'accept'
  | 'reject'
  | 'start_preparing'
  | 'mark_ready'
  | 'start_delivery_search'
  | 'cancel_delivery_search'
  | 'verify_pickup_otp'
  | 'cancel_order'
  | 'set_status';
export type VendorOrderSnapshot = Order & {
  updated_at: string;
  state_version: string;
  allowed_actions: VendorOrderCommand[];
};
export interface VendorPaged<T> extends PaginatedResponse<T> {
  summary?: Record<string, number | VendorMoney>;
  unread_count?: number;
}
export interface VendorPayout {
  id: string;
  vendor_name: string;
  period_start: string;
  period_end: string;
  gross_sales: VendorMoney;
  platform_commission: VendorMoney;
  net_payout: VendorMoney;
  status:
    | 'pending_approval'
    | 'approved'
    | 'scheduled'
    | 'paid'
    | 'verified'
    | 'failed';
  transaction_ref: string;
  vendor_rejection_reason: string;
  paid_at: string | null;
  payment_sent_at: string | null;
  vendor_verified_at: string | null;
}
export interface VendorPayoutPage extends VendorPaged<VendorPayout> {
  payout_summary: {
    status: VendorPayout['status'];
    count: number;
    amount: VendorMoney;
  }[];
  summary_scope: 'all_time';
}
export interface VendorTransaction {
  id: string;
  amount: VendorMoney;
  transaction_type: 'credit' | 'debit';
  source: string;
  description: string;
  reference_id: string;
  balance_after: VendorMoney;
  created_at: string;
}
export interface VendorTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  admin_response: string;
  created_at: string;
  responded_at: string | null;
}
export interface VendorReview {
  id: string;
  rating: number;
  comment: string;
  customer_name: string;
  created_at: string;
}
export interface VendorReviewPage extends VendorPaged<VendorReview> {
  rating_summary: {
    average: number;
    total: number;
    distribution: Record<string, number>;
  };
}
export interface VendorDocument {
  id: string;
  document_type: string;
  document_type_label: string;
  status: string;
  original_filename: string;
  rejection_reason: string;
  uploaded_at: string;
}
export type VendorProductPage = VendorPaged<Product>;
export type VendorCatalogPage = VendorPaged<CatalogProduct>;
export type VendorNotificationPage = VendorPaged<Notification>;

export interface VendorCoupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed' | 'free_delivery';
  discount_value: VendorMoney;
  min_order_amount: VendorMoney;
  max_discount_amount: VendorMoney | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  status_label: string;
  health_warnings: string[];
  revenue_influenced: VendorMoney;
}
