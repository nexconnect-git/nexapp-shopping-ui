import {
  Cart,
  DeliveryStatus,
  DeliveryAssignment,
  FeatureFlag,
  Inventory,
  Order,
  OrderItemSnapshot,
  OrderStatus,
  ParentCatalogItem,
  PaymentStatus,
  Store,
  User,
  VendorProduct,
} from './index';

const ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  created: 'created',
  pending_payment: 'pending_payment',
  confirmed: 'confirmed',
  vendor_accepted: 'vendor_accepted',
  preparing: 'preparing',
  packed: 'packed',
  ready_for_pickup: 'ready_for_pickup',
  delivery_assigned: 'delivery_assigned',
  picked_up: 'picked_up',
  out_for_delivery: 'out_for_delivery',
  arrived_at_customer: 'arrived_at_customer',
  delivered: 'delivered',
  cancelled: 'cancelled',
  refunded: 'refunded',
  placed: 'placed',
  ready: 'ready',
  on_the_way: 'on_the_way',
};

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  created: 'created',
  pending: 'pending',
  success: 'success',
  failed: 'failed',
  refund_initiated: 'refund_initiated',
  refunded: 'refunded',
  none: 'none',
  initiated: 'initiated',
  processed: 'processed',
};

const DELIVERY_STATUS_MAP: Record<string, DeliveryStatus> = {
  available: 'available',
  assigned: 'assigned',
  accepted: 'accepted',
  arrived_at_store: 'arrived_at_store',
  pickup_verified: 'pickup_verified',
  picked_up: 'picked_up',
  on_the_way: 'on_the_way',
  arrived_at_customer: 'arrived_at_customer',
  delivery_verified: 'delivery_verified',
  delivered: 'delivered',
  cancelled: 'cancelled',
  timed_out: 'timed_out',
  searching: 'searching',
  notified: 'notified',
  failed: 'failed',
};

function normalizeKey(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(input: unknown): string {
  return input == null ? '' : String(input);
}

function coordinateValue(input: unknown): string | number | null {
  if (typeof input === 'number' || typeof input === 'string') {
    return input;
  }
  return null;
}

export function normalizeOrderStatus(value: unknown): OrderStatus {
  const key = normalizeKey(value);
  return ORDER_STATUS_MAP[key] || 'created';
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  const key = normalizeKey(value);
  return PAYMENT_STATUS_MAP[key] || 'pending';
}

export function normalizeDeliveryStatus(value: unknown): DeliveryStatus {
  const key = normalizeKey(value);
  return DELIVERY_STATUS_MAP[key] || 'searching';
}

export function mapParentCatalogItemFromApi(
  value: unknown,
): ParentCatalogItem {
  const src = asRecord(value);
  const status = normalizeKey(src['status']);
  return {
    id: stringValue(src['id']),
    category: (src['category'] as ParentCatalogItem['category']) ?? null,
    name: stringValue(src['name']),
    slug: stringValue(src['slug']),
    description: stringValue(src['description']),
    brand: stringValue(src['brand']),
    unit: stringValue(src['unit']),
    barcode: stringValue(src['barcode']),
    search_keywords: stringValue(src['search_keywords']),
    compliance_notes: stringValue(src['compliance_notes']),
    is_active: Boolean(src['is_active'] ?? src['active'] ?? true),
    images: Array.isArray(src['images'])
      ? (src['images'] as ParentCatalogItem['images'])
      : [],
    created_at: stringValue(src['created_at']),
    updated_at: stringValue(src['updated_at']),
    status: status === 'inactive' ? 'inactive' : ('active' as const),
    category_id:
      (src['category_id'] as string | null) ||
      (asRecord(src['category'])['id'] as string | undefined) ||
      null,
    subcategory_id: (src['subcategory_id'] as string | null) ?? null,
    created_by_admin_id: (src['created_by_admin_id'] as string | null) ?? null,
    created_by_admin_name:
      (src['created_by_admin_name'] as string | null) ?? null,
    attributes:
      (src['attributes'] as Record<string, string | number | boolean | null>) ||
      undefined,
  };
}

export function mapVendorProductFromApi(value: unknown): VendorProduct {
  const src = asRecord(value);
  const vendor = asRecord(src['vendor']);
  const catalogProduct = asRecord(src['catalog_product']);
  return {
    ...(src as unknown as Partial<VendorProduct>),
    parent_catalog_item_id:
      (src['parent_catalog_item_id'] as string | null) ||
      (catalogProduct['id'] as string | undefined) ||
      null,
    parentCatalogItemId:
      (src['parentCatalogItemId'] as string | null) ||
      (src['parent_catalog_item_id'] as string | null) ||
      (catalogProduct['id'] as string | undefined) ||
      null,
    vendor_id:
      (src['vendor_id'] as string | undefined) ||
      (vendor['id'] as string | undefined) ||
      '',
    store_id:
      (src['store_id'] as string | undefined) ||
      (vendor['id'] as string | undefined) ||
      '',
    reserved_stock: Number(src['reserved_stock'] ?? src['reserved_qty'] ?? 0),
    available_stock: Number(
      src['available_stock'] ?? src['available_qty'] ?? src['stock'] ?? 0,
    ),
    pack_size:
      (src['pack_size'] as string | undefined) ||
      (src['weight'] as string | undefined),
    visibility:
      (src['visibility'] as string | undefined) ||
      (src['status'] as string | undefined),
    visible: Boolean(src['visible'] ?? src['is_available'] ?? true),
    approval_status:
      (normalizeKey(src['approval_status']) as VendorProduct['approval_status']) ||
      'draft',
  } as VendorProduct;
}

export function mapStoreFromApi(value: unknown): Store {
  const src = asRecord(value);
  return {
    ...(src as unknown as Store),
    vendor_id:
      (src['vendor_id'] as string | undefined) ||
      (asRecord(src['vendor'])['id'] as string | undefined) ||
      (src['id'] as string | undefined),
    name:
      (src['name'] as string | undefined) ||
      (src['store_name'] as string | undefined),
    category_ids: Array.isArray(src['category_ids'])
      ? (src['category_ids'] as string[])
      : [],
    opening_hours:
      (src['opening_hours'] as Record<string, unknown> | undefined) ||
      (src['operating_hours'] as Record<string, unknown> | undefined),
    accepting_orders: Boolean(
      src['accepting_orders'] ?? src['is_accepting_orders'] ?? true,
    ),
    store_status: (normalizeKey(src['status']) || 'active') as Store['store_status'],
  };
}

export function mapInventoryFromApi(value: unknown): Inventory {
  const src = asRecord(value);
  const stock = Number(src['stock_qty'] ?? src['stock_quantity'] ?? src['stock'] ?? 0);
  const reserved = Number(src['reserved_qty'] ?? src['reserved_quantity'] ?? 0);
  return {
    id: (src['id'] as string | undefined) || undefined,
    store_id: (src['store_id'] as string | undefined) || undefined,
    vendor_product_id: stringValue(
      src['vendor_product_id'] || src['product_id'] || src['id'],
    ),
    stock_qty: stock,
    reserved_qty: reserved,
    available_qty: Number(src['available_qty'] ?? src['available_stock'] ?? stock - reserved),
    stock_quantity: stock,
    reserved_quantity: reserved,
    available_stock: Number(src['available_stock'] ?? src['available_qty'] ?? stock - reserved),
    low_stock_threshold: Number(src['low_stock_threshold'] ?? 0),
    audit_note: (src['audit_note'] as string | undefined) || undefined,
    updated_at: (src['updated_at'] as string | undefined) || undefined,
  };
}

export function mapCartFromApi(value: unknown): Cart {
  const src = asRecord(value);
  const items = Array.isArray(src['items']) ? src['items'] : [];
  const firstItem = asRecord(items[0]);
  const product = asRecord(firstItem['product']);
  const vendor = asRecord(product['vendor']);
  return {
    ...(src as unknown as Cart),
    items: items as Cart['items'],
    store_id:
      (src['store_id'] as string | undefined) ||
      (src['vendor_id'] as string | undefined) ||
      (vendor['id'] as string | undefined),
    vendor_id:
      (src['vendor_id'] as string | undefined) ||
      (src['store_id'] as string | undefined) ||
      (vendor['id'] as string | undefined),
    coupon_code: (src['coupon_code'] as string | null) ?? null,
    updated_at: (src['updated_at'] as string | undefined) || undefined,
  };
}

export function mapOrderItemSnapshotFromApi(
  value: unknown,
): OrderItemSnapshot {
  const src = asRecord(value);
  return {
    id: stringValue(src['id']),
    order_id: (src['order_id'] as string | undefined) || undefined,
    vendor_product_id:
      (src['vendor_product_id'] as string | null) ||
      (src['product'] as string | undefined) ||
      null,
    parent_catalog_item_id:
      (src['parent_catalog_item_id'] as string | null) ?? null,
    product_name: stringValue(src['product_name'] || src['name']),
    brand: (src['brand'] as string | undefined) || undefined,
    pack_size:
      (src['pack_size'] as string | undefined) ||
      (src['weight'] as string | undefined),
    unit_price: Number(src['unit_price'] ?? src['product_price'] ?? 0),
    quantity: Number(src['quantity'] ?? 0),
    total_price: Number(src['total_price'] ?? src['subtotal'] ?? 0),
    store_id: (src['store_id'] as string | undefined) || undefined,
  };
}

export function mapOrderFromApi(value: unknown): Order {
  const src = asRecord(value);
  const vendorInfo = asRecord(src['vendor_info']);
  return {
    ...(src as unknown as Order),
    normalized_status: normalizeOrderStatus(src['normalized_status'] || src['status']),
    payment_status: normalizePaymentStatus(
      src['payment_status'] ||
        (src['is_payment_verified'] ? 'success' : 'pending'),
    ),
    assignment_status: src['assignment_status']
      ? normalizeDeliveryStatus(src['assignment_status'])
      : null,
    store_id:
      (src['store_id'] as string | undefined) ||
      (src['vendor_id'] as string | undefined) ||
      (vendorInfo['id'] as string | undefined),
    vendor_id:
      (src['vendor_id'] as string | undefined) ||
      (src['store_id'] as string | undefined) ||
      (vendorInfo['id'] as string | undefined),
  };
}

export function mapDeliveryAssignmentFromApi(
  value: unknown,
): DeliveryAssignment {
  const src = asRecord(value);
  return {
    ...(src as unknown as DeliveryAssignment),
    status: normalizeDeliveryStatus(src['status']),
    store_id:
      (src['store_id'] as string | undefined) ||
      (src['vendor_id'] as string | undefined),
    delivery_partner_id:
      (src['delivery_partner_id'] as string | null) ||
      (src['accepted_partner_id'] as string | undefined) ||
      null,
    pickup_latitude: coordinateValue(
      src['pickup_latitude'] ?? src['vendor_lat'],
    ),
    pickup_longitude: coordinateValue(
      src['pickup_longitude'] ?? src['vendor_lng'],
    ),
    drop_latitude: coordinateValue(
      src['drop_latitude'] ?? src['delivery_latitude'],
    ),
    drop_longitude: coordinateValue(
      src['drop_longitude'] ?? src['delivery_longitude'],
    ),
  };
}

export function mapFeatureFlagFromApi(value: unknown): FeatureFlag {
  const src = asRecord(value);
  const statusKey = normalizeKey(src['status']);
  return {
    key: stringValue(src['key'] || src['feature_key']),
    app_id: (src['app_id'] as string | undefined) || undefined,
    page_id: (src['page_id'] as string | undefined) || undefined,
    role: (src['role'] as User['role']) || undefined,
    status:
      statusKey === 'enabled' || statusKey === 'disabled'
        ? statusKey
        : 'partial',
    reason: (src['reason'] as string | undefined) || undefined,
  };
}
