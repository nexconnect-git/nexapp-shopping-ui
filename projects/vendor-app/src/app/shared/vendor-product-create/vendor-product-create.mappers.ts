import { CatalogProduct, Product } from '@shared/public-api';
import {
  ApprovedCatalogItem,
  VendorVariantDraft,
} from './vendor-product-create.models';
export function mapApprovedCatalogDtoToItem(
  dto: CatalogProduct
): ApprovedCatalogItem {
  return {
    id: dto.id,
    name: dto.name,
    brand: dto.brand,
    category: dto.category?.name || 'No category',
    unit: dto.unit,
    icon: 'inventory_2',
    status: dto.is_active ? 'Approved' : 'Pending',
    imageUrl:
      dto.images.find((image) => image.is_primary)?.image ||
      dto.images[0]?.image,
  };
}
export function mapProductDtoToVariantDraft(dto: Product): VendorVariantDraft {
  return {
    id: dto.id,
    catalogId: dto.catalog_product?.id || '',
    inheritanceMode:dto.inheritance_mode||'base_image',
    productName: dto.name,
    brand: dto.brand || dto.catalog_product?.brand || '',
    unit: dto.unit,
    quantityPackSize: dto.weight,
    price: Number(dto.price),
    comparePrice: dto.compare_price === null ? null : Number(dto.compare_price),
    stock: dto.stock,
    sku: dto.sku,
    barcode: dto.barcode || '',
    prepTime: String(dto.prep_time_minutes ?? 0),
    description: dto.description,
    packagingNotes: dto.packaging_instructions || '',
    shelfLife: dto.shelf_life || '',
    availability: dto.status === 'sold_out' ? 'Out of Stock' : 'In Stock',
    visibleOnStore: dto.is_available,
    instantDelivery: dto.is_instant_delivery ?? true,
    scheduledDelivery: dto.is_scheduled_delivery ?? true,
    imageUrl:
      dto.primary_image ||
      dto.images.find((image) => image.is_primary)?.image ||
      dto.catalog_product?.images[0]?.image ||
      '',
    tags: (dto.search_keywords || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}
export function mapVariantDraftToUpdatePayload(
  draft: VendorVariantDraft
): Record<string, unknown> {
  return {
    name: draft.productName,
    inheritance_mode:draft.inheritanceMode,
    brand: draft.brand,
    unit: draft.unit,
    weight: draft.quantityPackSize,
    price: draft.price,
    compare_price: draft.comparePrice ?? null,
    stock: draft.stock,
    sku: draft.sku,
    barcode: draft.barcode || '',
    prep_time_minutes: Number(draft.prepTime),
    description: draft.description,
    packaging_instructions: draft.packagingNotes || '',
    shelf_life: draft.shelfLife || '',
    search_keywords: draft.tags.join(', '),
    is_available: draft.visibleOnStore,
    is_instant_delivery: draft.instantDelivery,
    is_scheduled_delivery: draft.scheduledDelivery,
    status: draft.availability === 'Out of Stock' ? 'sold_out' : 'active',
  };
}
