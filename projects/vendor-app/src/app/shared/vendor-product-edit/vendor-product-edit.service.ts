import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ApiService,
  FieldErrors,
  firstFieldError,
  parseFormErrors,
  ToastService,
} from '@shared/public-api';
import {
  ProductEditSaveEvent,
  ProductReadinessItem,
  VendorProductEdit,
} from './vendor-product-edit.models';
import {
  mapExistingProductDtoToEdit,
  mapVendorProductEditToUpdatePayload,
} from './vendor-product-edit.mappers';

const EMPTY_PRODUCT: VendorProductEdit = {
  id: '',
  productName: '',
  brand: '',
  sku: '',
  category: 'Uncategorized',
  unit: 'piece',
  quantityPackSize: '',
  imageUrl: '',
  price: 0,
  comparePrice: null,
  stock: 0,
  lowStockThreshold: 0,
  minOrderQuantity: 1,
  prepTimeMinutes: 0,
  status: 'Draft',
  availableForSale: false,
  instantDelivery: true,
  scheduledDelivery: true,
  description: '',
  ingredients: '',
  complianceNotes: '',
  allergens: '',
  shelfLife: '',
  packagingInstructions: '',
  perishable: false,
  coldStorage: false,
  fragile: false,
  ageRestricted: false,
  returnable: true,
  lastUpdatedAt: 'Not saved yet',
  updatedBy: 'Vendor',
  requiresApproval: true,
  approvalStatus: 'draft',
  approvalStatusLabel: 'Draft',
  rejectionReason: '',
};

@Injectable({ providedIn: 'root' })
export class VendorProductEditService {
  private readonly api = inject(ApiService);
  private readonly globalToast = inject(ToastService);

  readonly product = signal<VendorProductEdit>({ ...EMPTY_PRODUCT });
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly toast = signal('');
  readonly error = signal('');
  readonly fieldErrors = signal<FieldErrors>({});

  readonly categories = [
    'Uncategorized',
    'Staples & Grains',
    'Fruits & Vegetables',
    'Dairy & Eggs',
    'Bakery',
    'Snacks',
    'Beverages',
    'Personal Care',
    'Home Care',
  ];

  readonly units = [
    'piece',
    'pcs',
    'pack',
    'dozen',
    'box',
    'bag',
    'bottle',
    'tray',
    'bunch',
    'pair',
    'kg',
    'g',
    'litre',
    'ml',
  ];

  readonly statuses: VendorProductEdit['status'][] = [
    'Active',
    'Draft',
    'Paused',
    'Out of Stock',
  ];

  async loadProduct(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.fieldErrors.set({});
    try {
      const product = await firstValueFrom(this.api.getVendorProduct(id));
      this.product.set(mapExistingProductDtoToEdit(product));
      localStorage.setItem(
        `vendor_product_name_${id}`,
        product?.name || 'Product',
      );
    } catch {
      this.error.set('Failed to load product for editing.');
      this.showToast(this.error(), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  patch(patch: Partial<VendorProductEdit>): void {
    this.product.update((current) => ({ ...current, ...patch }));
    this.clearFieldErrors(Object.keys(patch));
  }

  toggle(key: keyof VendorProductEdit): void {
    const current = this.product();
    this.patch({ [key]: !current[key] } as Partial<VendorProductEdit>);
  }

  readinessItems(product = this.product()): ProductReadinessItem[] {
    return [
      {
        label: 'Selling details completed',
        completed: Boolean(
          product.price > 0 &&
          product.stock >= 0 &&
          product.minOrderQuantity >= 1,
        ),
      },
      {
        label: 'Catalog information added',
        completed: Boolean(
          product.productName && product.brand && product.unit,
        ),
      },
      {
        label: 'Product attributes set',
        completed: Boolean(product.description),
      },
      {
        label: 'Delivery controls set',
        completed: product.instantDelivery || product.scheduledDelivery,
      },
      {
        label: 'Ready for publication',
        completed: product.availableForSale && product.status === 'Active',
      },
    ];
  }

  readinessScore(product = this.product()): number {
    const items = this.readinessItems(product);
    return items.filter((item) => item.completed).length;
  }

  async save(
    mode: ProductEditSaveEvent['mode'],
  ): Promise<ProductEditSaveEvent> {
    const product = this.product();
    const validation = this.validate(product);
    if (Object.keys(validation).length) {
      const message = firstFieldError(
        validation,
        'Fix the highlighted product fields.',
      );
      this.fieldErrors.set(validation);
      this.error.set(message);
      this.showToast(message, 'error');
      throw new Error(message);
    }

    this.saving.set(true);
    this.error.set('');
    try {
      const payload = mapVendorProductEditToUpdatePayload({
        ...product,
        status: mode === 'draft' ? 'Draft' : product.status,
      });
      const updated = await firstValueFrom(
        this.api.patchProduct(product.id, payload),
      );
      const mapped = mapExistingProductDtoToEdit(updated);
      this.product.set(mapped);

      const message =
        mode === 'draft'
          ? 'Product draft saved'
          : mapped.approvalStatus === 'pending_approval' ||
              mapped.requiresApproval
            ? 'Changes saved for admin review'
            : 'Product changes saved';

      this.showToast(message, 'success');
      return { mode, product: mapped };
    } catch (err: any) {
      const parsed = parseFormErrors(
        err?.error,
        this.apiFieldMap,
        this.friendlyApiMessages,
      );
      const message = parsed.summary || 'Failed to save product.';
      this.fieldErrors.set(parsed.fieldErrors);
      this.error.set(message);
      this.showToast(message, 'error');
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  preview(): void {
    this.showToast(
      'Product preview is not available inside the vendor app yet.',
      'info',
    );
  }

  showToast(
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
  ): void {
    this.toast.set(message);
    this.globalToast.show(message, type);
    window.setTimeout(() => this.toast.set(''), 2200);
  }

  fieldError(field: keyof VendorProductEdit): string {
    return this.fieldErrors()[field] || '';
  }

  clearFieldErrors(fields: string[]): void {
    if (!fields.length) return;
    const current = { ...this.fieldErrors() };
    fields.forEach((field) => delete current[field]);
    this.fieldErrors.set(current);
    if (!Object.keys(current).length) this.error.set('');
  }

  private validate(product: VendorProductEdit): FieldErrors {
    const errors: FieldErrors = {};
    if (!product.productName?.trim())
      errors['productName'] = 'Product name is required.';
    if (!product.brand?.trim()) errors['brand'] = 'Brand is required.';
    if (!product.unit?.trim()) errors['unit'] = 'Unit is required.';
    if (!product.quantityPackSize?.trim())
      errors['quantityPackSize'] = 'Pack size is required.';
    if (Number(product.price) <= 0)
      errors['price'] = 'Price must be greater than 0.';
    if (Number(product.stock) < 0)
      errors['stock'] = 'Stock cannot be negative.';
    if (Number(product.minOrderQuantity) < 1)
      errors['minOrderQuantity'] = 'Minimum order quantity must be at least 1.';
    if (!product.description?.trim())
      errors['description'] = 'Description is required.';
    return errors;
  }

  private readonly apiFieldMap: Record<string, string> = {
    name: 'productName',
    weight: 'quantityPackSize',
    compare_price: 'comparePrice',
    low_stock_threshold: 'lowStockThreshold',
    min_order_quantity: 'minOrderQuantity',
    prep_time_minutes: 'prepTimeMinutes',
    packaging_instructions: 'packagingInstructions',
    compliance_notes: 'complianceNotes',
    shelf_life: 'shelfLife',
    is_available: 'availableForSale',
    is_instant_delivery: 'instantDelivery',
    is_scheduled_delivery: 'scheduledDelivery',
    is_perishable: 'perishable',
    requires_cold_storage: 'coldStorage',
    is_fragile: 'fragile',
    is_age_restricted: 'ageRestricted',
    is_returnable: 'returnable',
    status: 'status',
  };

  private readonly friendlyApiMessages: Record<string, string> = {
    status: 'Choose a valid product status.',
    price: 'Enter a selling price greater than 0.',
    stock: 'Enter a valid stock quantity.',
    min_order_quantity: 'Minimum order quantity must be at least 1.',
    weight: 'Enter the pack size customers will see.',
    name: 'Product name is required.',
    brand: 'Brand is required.',
    unit: 'Unit is required.',
    description: 'Description is required.',
  };
}
