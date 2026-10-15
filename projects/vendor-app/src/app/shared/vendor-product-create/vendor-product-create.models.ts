export type CreateProductStep = 'catalog' | 'variants' | 'fulfillment' | 'review';
export interface ApprovedCatalogItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  icon: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  imageUrl?: string;
}
export interface VendorVariantDraft {
  inheritanceMode:'base_image'|'vendor_image_only'|'mixed';
  id: string;
  catalogId: string;
  productName: string;
  brand: string;
  unit: string;
  quantityPackSize: string;
  price: number;
  comparePrice?: number | null;
  stock: number;
  sku: string;
  barcode?: string;
  prepTime: string;
  description: string;
  packagingNotes?: string;
  shelfLife?: string;
  availability: 'In Stock' | 'Out of Stock';
  visibleOnStore: boolean;
  instantDelivery: boolean;
  scheduledDelivery: boolean;
  imageUrl?: string;
  tags: string[];
}
export interface CreateProductSubmitPayload {
  selectedCatalogItems: ApprovedCatalogItem[];
  variants: VendorVariantDraft[];
  approvalNote: string;
}
