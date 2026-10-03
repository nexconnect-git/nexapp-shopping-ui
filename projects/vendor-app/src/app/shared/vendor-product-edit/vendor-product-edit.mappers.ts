import { Product } from '@shared/public-api';
import { VendorProductEdit } from './vendor-product-edit.models';

export function mapExistingProductDtoToEdit(dto: Product): VendorProductEdit {
  const status = mapStatus(dto?.status);
  const updated =
    dto?.updated_at || dto?.reviewed_at || dto?.approval_requested_at;

  return {
    id: String(dto?.id || ''),
    inheritanceMode: dto.inheritance_mode || 'base_image',
    productName: dto?.name || dto?.catalog_product?.name || 'Product',
    brand: dto?.brand || dto?.catalog_product?.brand || '',
    sku: dto?.sku || '',
    category:
      dto?.category?.name ||
      dto?.catalog_product?.category?.name ||
      'Uncategorized',
    unit: dto?.unit || dto?.catalog_product?.unit || 'piece',
    quantityPackSize: dto?.weight || '',
    imageUrl:
      dto?.primary_image ||
      dto?.images?.find?.((image) => image?.is_primary)?.image ||
      dto?.catalog_product?.images?.[0]?.image ||
      '',
    price: toNumber(dto?.price),
    comparePrice:
      dto?.compare_price === null || dto?.compare_price === undefined
        ? null
        : toNumber(dto.compare_price),
    stock: toNumber(dto?.stock),
    lowStockThreshold: toNumber(dto?.low_stock_threshold),
    minOrderQuantity: toNumber(dto?.min_order_quantity || 1),
    prepTimeMinutes: toNumber(dto?.prep_time_minutes),
    status,
    availableForSale: dto?.is_available ?? status === 'Active',
    instantDelivery: dto?.is_instant_delivery ?? true,
    scheduledDelivery: dto?.is_scheduled_delivery ?? true,
    description: dto?.description || dto?.catalog_product?.description || '',
    ingredients: dto?.ingredients || '',
    complianceNotes: dto?.compliance_notes || '',
    allergens: dto?.allergens || '',
    shelfLife: dto?.shelf_life || '',
    packagingInstructions: dto?.packaging_instructions || '',
    perishable: dto?.is_perishable ?? false,
    coldStorage: dto?.requires_cold_storage ?? false,
    fragile: dto?.is_fragile ?? false,
    ageRestricted: dto?.is_age_restricted ?? false,
    returnable: dto?.is_returnable ?? true,
    lastUpdatedAt: updated
      ? new Date(updated).toLocaleString()
      : 'Not saved yet',
    updatedBy: dto?.vendor_name || dto?.vendor?.store_name || 'Vendor',
    requiresApproval:
      dto?.requires_admin_review ?? dto?.approval_status !== 'approved',
    approvalStatus: dto?.approval_status || 'draft',
    approvalStatusLabel: dto?.approval_status_label || 'Draft',
    rejectionReason: dto?.rejection_reason || '',
  };
}

export function mapVendorProductEditToUpdatePayload(
  product: VendorProductEdit
): Record<string, unknown> {
  return {
    name: product.productName,
    inheritance_mode: product.inheritanceMode,
    brand: product.brand,
    sku: product.sku,
    unit: product.unit,
    weight: product.quantityPackSize,
    price: Number(product.price || 0),
    compare_price:
      product.comparePrice === undefined ? null : product.comparePrice,
    stock: Number(product.stock || 0),
    low_stock_threshold: Number(product.lowStockThreshold || 0),
    min_order_quantity: Number(product.minOrderQuantity || 1),
    prep_time_minutes: Number(product.prepTimeMinutes || 0),
    status: apiStatus(product.status),
    is_available: product.availableForSale,
    is_instant_delivery: product.instantDelivery,
    is_scheduled_delivery: product.scheduledDelivery,
    description: product.description,
    ingredients: product.ingredients,
    compliance_notes: product.complianceNotes,
    allergens: product.allergens,
    shelf_life: product.shelfLife,
    packaging_instructions: product.packagingInstructions,
    is_perishable: product.perishable,
    requires_cold_storage: product.coldStorage,
    is_fragile: product.fragile,
    is_age_restricted: product.ageRestricted,
    is_returnable: product.returnable,
  };
}

function mapStatus(status: string | undefined): VendorProductEdit['status'] {
  if (status === 'sold_out') return 'Out of Stock';
  if (status === 'draft') return 'Draft';
  if (status === 'archived') return 'Archived';
  if (status === 'coming_soon') return 'Coming Soon';
  return 'Active';
}

function apiStatus(status: VendorProductEdit['status']): string {
  if (status === 'Draft') return 'draft';
  if (status === 'Archived') return 'archived';
  if (status === 'Coming Soon') return 'coming_soon';
  if (status === 'Out of Stock') return 'sold_out';
  return 'active';
}

function toNumber(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}
