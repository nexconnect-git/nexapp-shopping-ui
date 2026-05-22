export type CreateProductStep =
  | 'catalog'
  | 'variant-1'
  | 'variant-2'
  | 'review';

export interface ApprovedCatalogItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  icon: string;
  status: 'Approved' | 'Pending' | 'Rejected';
}

export interface VendorVariantDraft {
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
  availability: 'In Stock' | 'Preorder' | 'Out of Stock';
  allowBackorder: boolean;
  visibleOnStore: boolean;
  requiresShipping: boolean;
  imageUrl?: string;
  tags: string[];
}

export interface CreateProductSummary {
  selectedCatalogCount: number;
  variantDraftCount: number;
  readyForReview: boolean;
}

export interface CreateProductSubmitPayload {
  selectedCatalogItems: ApprovedCatalogItem[];
  variants: VendorVariantDraft[];
  approvalNote: string;
}
