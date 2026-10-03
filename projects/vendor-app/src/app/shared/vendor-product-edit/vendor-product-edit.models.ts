export type ProductStatus = 'Active' | 'Draft' | 'Out of Stock' | 'Archived' | 'Coming Soon';

export interface VendorProductEdit {
  inheritanceMode: 'base_image' | 'vendor_image_only' | 'mixed';
  id: string;
  productName: string;
  brand: string;
  sku: string;
  category: string;
  unit: string;
  quantityPackSize: string;
  imageUrl?: string;
  price: number;
  comparePrice?: number | null;
  stock: number;
  lowStockThreshold: number;
  minOrderQuantity: number;
  prepTimeMinutes: number;
  status: ProductStatus;
  availableForSale: boolean;
  instantDelivery: boolean;
  scheduledDelivery: boolean;
  description: string;
  ingredients: string;
  complianceNotes: string;
  allergens: string;
  shelfLife: string;
  packagingInstructions: string;
  perishable: boolean;
  coldStorage: boolean;
  fragile: boolean;
  ageRestricted: boolean;
  returnable: boolean;
  lastUpdatedAt: string;
  updatedBy: string;
  requiresApproval: boolean;
  approvalStatus?: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  approvalStatusLabel?: string;
  rejectionReason?: string;
}

export interface ProductReadinessItem {
  label: string;
  completed: boolean;
}

export interface ProductEditSaveEvent {
  mode: 'draft' | 'changes';
  product: VendorProductEdit;
}
