import {
  ApprovedCatalogItem,
  VendorVariantDraft,
} from './vendor-product-create.models';

export function mapApprovedCatalogDtoToItem(dto: any): ApprovedCatalogItem {
  const categoryName =
    dto?.category?.name || dto?.category_name || 'Uncategorized';

  return {
    id: String(dto?.id || ''),
    name: dto?.name || 'Catalog item',
    brand: dto?.brand || 'Store brand',
    category: categoryName,
    unit: dto?.unit || 'piece',
    icon: iconForCategory(categoryName),
    status: dto?.is_active === false ? 'Pending' : 'Approved',
  };
}

export function mapProductDtoToVariantDraft(dto: any): VendorVariantDraft {
  const catalog = dto?.catalog_product || {};
  const productName = dto?.name || catalog?.name || 'New variant';

  return {
    id: String(dto?.id || ''),
    catalogId: String(catalog?.id || dto?.catalog_product_id || ''),
    productName,
    brand: dto?.brand || catalog?.brand || '',
    unit: dto?.unit || catalog?.unit || 'piece',
    quantityPackSize: dto?.weight || '',
    price: toNumber(dto?.price),
    comparePrice:
      dto?.compare_price === null || dto?.compare_price === undefined
        ? null
        : toNumber(dto.compare_price),
    stock: toNumber(dto?.stock),
    sku: dto?.sku || skuFromName(productName),
    barcode: dto?.barcode || catalog?.barcode || '',
    prepTime: String(dto?.prep_time_minutes ?? 0),
    description: dto?.description || catalog?.description || '',
    packagingNotes: dto?.packaging_instructions || '',
    shelfLife: dto?.shelf_life || '',
    availability: availabilityFromProduct(dto),
    allowBackorder: false,
    visibleOnStore: dto?.is_available ?? true,
    requiresShipping: dto?.is_instant_delivery ?? true,
    imageUrl:
      dto?.primary_image ||
      dto?.images?.find?.((image: any) => image?.is_primary)?.image ||
      catalog?.images?.[0]?.image ||
      '',
    tags: splitTags(dto?.search_keywords),
  };
}

export function mapVariantDraftToUpdatePayload(draft: VendorVariantDraft): any {
  return {
    name: draft.productName,
    brand: draft.brand,
    unit: draft.unit,
    weight: draft.quantityPackSize,
    price: Number(draft.price || 0),
    compare_price: draft.comparePrice === undefined ? null : draft.comparePrice,
    stock: Number(draft.stock || 0),
    sku: draft.sku,
    barcode: draft.barcode || '',
    prep_time_minutes: parsePrepTime(draft.prepTime),
    description: draft.description,
    packaging_instructions: draft.packagingNotes || '',
    shelf_life: draft.shelfLife || '',
    search_keywords: draft.tags.join(', '),
    is_available: draft.visibleOnStore && draft.availability !== 'Out of Stock',
    is_instant_delivery: draft.requiresShipping,
    is_scheduled_delivery: true,
    status: statusFromAvailability(draft.availability, draft.visibleOnStore),
  };
}

function iconForCategory(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('dairy')) return 'D';
  if (normalized.includes('fruit') || normalized.includes('vegetable'))
    return 'F';
  if (normalized.includes('bakery')) return 'B';
  if (normalized.includes('beverage')) return 'V';
  if (
    normalized.includes('grain') ||
    normalized.includes('staple') ||
    normalized.includes('pantry')
  )
    return 'G';
  return 'P';
}

function availabilityFromProduct(
  product: any,
): VendorVariantDraft['availability'] {
  if (product?.status === 'coming_soon') return 'Preorder';
  if (product?.status === 'sold_out' || Number(product?.stock || 0) <= 0)
    return 'Out of Stock';
  return 'In Stock';
}

function statusFromAvailability(
  availability: VendorVariantDraft['availability'],
  visible: boolean,
): string {
  if (!visible) return 'draft';
  if (availability === 'Out of Stock') return 'sold_out';
  if (availability === 'Preorder') return 'coming_soon';
  return 'active';
}

function splitTags(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function skuFromName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function parsePrepTime(value: string): number {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function toNumber(value: any): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}
