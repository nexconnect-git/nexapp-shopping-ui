import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  apiErrorMessage,
  AuthService,
  FieldErrors,
  firstFieldError,
  parseFormErrors,
  Product,
  ToastService,
  VendorWorkspaceApi,
} from '@shared/public-api';
import {
  ProductEditSaveEvent,
  VendorProductEdit,
} from './vendor-product-edit.models';
import {
  mapExistingProductDtoToEdit,
  mapVendorProductEditToUpdatePayload,
} from './vendor-product-edit.mappers';

const EMPTY_PRODUCT: VendorProductEdit = {
  id: '',
  inheritanceMode: 'base_image',
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
  private readonly auth = inject(AuthService);
  private owner = '';
  private generation = 0;
  private requestedId = '';
  readonly canRetryLoad = signal(false);
  constructor() {
    effect(() => {
      const owner = this.auth.user()?.id || '';
      if (owner !== this.owner) {
        this.owner = owner;
        this.generation++;
        this.snapshot.set(null);
        this.product.set({ ...EMPTY_PRODUCT });
        this.savedProduct.set('');
        this.saving.set(false);
        this.loading.set(false);
        this.error.set('');
      }
    });
  }
  private current(generation: number, session: number): boolean {
    return (
      generation === this.generation && session === this.auth.sessionVersion
    );
  }
  private syncMedia(updated: Product): void {
    this.snapshot.set(updated);
    const mapped = mapExistingProductDtoToEdit(updated);
    const metadata = {
      imageUrl: mapped.imageUrl,
      inheritanceMode: mapped.inheritanceMode,
      approvalStatus: mapped.approvalStatus,
      approvalStatusLabel: mapped.approvalStatusLabel,
      requiresApproval: mapped.requiresApproval,
      rejectionReason: mapped.rejectionReason,
      lastUpdatedAt: mapped.lastUpdatedAt,
    };
    this.product.update((current) => ({ ...current, ...metadata }));
    const saved = JSON.parse(this.savedProduct()) as VendorProductEdit;
    this.savedProduct.set(JSON.stringify({ ...saved, ...metadata }));
  }
  private readonly api = inject(VendorWorkspaceApi);
  private readonly globalToast = inject(ToastService);

  readonly savedProduct = signal<string>('');
  readonly dirty = computed(
    () =>
      !!this.product().id &&
      JSON.stringify(this.product()) !== this.savedProduct()
  );
  readonly snapshot = signal<Product | null>(null);
  readonly product = signal<VendorProductEdit>({ ...EMPTY_PRODUCT });
  readonly imageEditBlocked = computed(() => {
    const saved = this.snapshot();
    if (!saved) return false;
    const before = mapVendorProductEditToUpdatePayload(
      mapExistingProductDtoToEdit(saved)
    );
    const after = mapVendorProductEditToUpdatePayload(this.product());
    return Object.keys(after).some(
      (key) =>
        key !== 'inheritance_mode' &&
        JSON.stringify(after[key]) !== JSON.stringify(before[key])
    );
  });
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly toast = signal('');
  readonly error = signal('');
  readonly fieldErrors = signal<FieldErrors>({});

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
    'Out of Stock',
  ];

  async loadProduct(id: string): Promise<void> {
    this.requestedId = id;
    this.canRetryLoad.set(false);
    const generation = ++this.generation;
    const session = this.auth.sessionVersion;
    this.loading.set(true);
    this.snapshot.set(null);
    this.product.set({ ...EMPTY_PRODUCT });
    this.savedProduct.set(JSON.stringify(this.product()));
    this.error.set('');
    this.fieldErrors.set({});
    try {
      const product = await firstValueFrom(this.api.product(id));
      if (!this.current(generation, session)) return;
      this.snapshot.set(product);
      this.product.set(mapExistingProductDtoToEdit(product));
      this.savedProduct.set(JSON.stringify(this.product()));
      const storedErrors = this.validate(this.product());
      this.fieldErrors.set(storedErrors);
      if (Object.keys(storedErrors).length)
        this.error.set(
          'Some saved fields need correction. See the field explanations below.'
        );
      localStorage.setItem(
        `vendor_product_name_${id}`,
        product?.name || 'Product'
      );
    } catch (failure) {
      if (!this.current(generation, session)) return;
      const status = failure instanceof HttpErrorResponse ? failure.status : 0;
      this.canRetryLoad.set(status === 0 || status >= 500);
      this.error.set(
        status === 404
          ? 'This product was not found in your store.'
          : status === 403
          ? 'You do not have permission to edit this product.'
          : apiErrorMessage(
              failure,
              'Product details are temporarily unavailable. Retry loading.'
            )
      );
    } finally {
      if (this.current(generation, session)) this.loading.set(false);
    }
  }

  retryLoad(): void {
    if (this.canRetryLoad() && !this.loading())
      void this.loadProduct(this.requestedId);
  }

  patch(patch: Partial<VendorProductEdit>): void {
    this.product.update((current) => ({ ...current, ...patch }));
    this.clearFieldErrors(Object.keys(patch));
  }

  discard(): void {
    if (this.saving() || !this.snapshot()) return;
    this.product.set(mapExistingProductDtoToEdit(this.snapshot()!));
    this.savedProduct.set(JSON.stringify(this.product()));
    this.fieldErrors.set({});
    this.error.set('');
  }

  toggle(key: keyof VendorProductEdit): void {
    const current = this.product();
    this.patch({ [key]: !current[key] } as Partial<VendorProductEdit>);
  }

  async save(
    mode: ProductEditSaveEvent['mode']
  ): Promise<ProductEditSaveEvent> {
    if (this.saving()) throw new Error('A save is already in progress.');
    const generation = this.generation;
    const session = this.auth.sessionVersion;
    const product = this.product();
    const validation = this.validate(product);
    if (Object.keys(validation).length) {
      const message = firstFieldError(
        validation,
        'Fix the highlighted product fields.'
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
      const previous = this.snapshot();
      const previousPayload = previous
        ? mapVendorProductEditToUpdatePayload(
            mapExistingProductDtoToEdit(previous)
          )
        : {};
      const changes = Object.fromEntries(
        Object.entries(payload).filter(
          ([key, value]) =>
            JSON.stringify(value) !== JSON.stringify(previousPayload[key])
        )
      );
      if (!Object.keys(changes).length && previous) return { mode, product };
      const updated = await firstValueFrom(
        this.api.updateProduct(product.id, changes)
      );
      if (!this.current(generation, session))
        throw new Error('Session changed during save.');
      this.snapshot.set(updated);
      const mapped = mapExistingProductDtoToEdit(updated);
      this.product.set(mapped);
      this.savedProduct.set(JSON.stringify(this.product()));

      const message =
        mode === 'draft'
          ? 'Product draft saved'
          : mapped.approvalStatus === 'pending_approval' ||
            mapped.requiresApproval
          ? 'Changes saved for admin review'
          : 'Product changes saved';

      this.showToast(message, 'success');
      return { mode, product: mapped };
    } catch (err: unknown) {
      if (!this.current(generation, session)) throw err;
      const parsed = parseFormErrors(
        err && typeof err === 'object' && 'error' in err ? err.error : err,
        this.apiFieldMap,
        this.friendlyApiMessages
      );
      const message = parsed.summary || 'Failed to save product.';
      this.fieldErrors.set(parsed.fieldErrors);
      this.error.set(message);
      this.showToast(message, 'error');
      throw err;
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }

  async submit(): Promise<void> {
    const generation = this.generation;
    const session = this.auth.sessionVersion;
    if (this.saving() || this.dirty()) return;
    const product = this.snapshot();
    if (
      !product ||
      !['draft', 'rejected'].includes(product.approval_status || '')
    )
      return;
    this.saving.set(true);
    this.error.set('');
    try {
      const values = await firstValueFrom(
        this.api.submitDrafts([product.id], product.approval_note || '')
      );
      const updated = values.find((item) => item.id === product.id);
      if (!updated) throw new Error('The server did not confirm submission.');
      if (!this.current(generation, session)) return;
      this.snapshot.set(updated);
      this.product.set(mapExistingProductDtoToEdit(updated));
      this.savedProduct.set(JSON.stringify(this.product()));
      this.showToast('Submitted for admin approval.', 'success');
    } catch (failure) {
      if (!this.current(generation, session)) return;
      this.error.set(apiErrorMessage(failure, 'Product was not submitted.'));
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }
  async imageCommand(id: string, command: 'primary' | 'delete'): Promise<void> {
    const generation = this.generation;
    const session = this.auth.sessionVersion;
    if (this.saving()) return;
    if (this.imageEditBlocked()) {
      this.error.set(
        'Save or discard your field changes before changing images.'
      );
      return;
    }
    const product = this.snapshot();
    if (!product) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        command === 'delete'
          ? this.api.deleteProductImage(product.id, id)
          : this.api.primaryProductImage(product.id, id)
      );
      if (!this.current(generation, session)) return;
      const updated = await firstValueFrom(this.api.product(product.id));
      if (!this.current(generation, session)) return;
      this.syncMedia(updated);
      this.showToast(
        command === 'delete' ? 'Image removed.' : 'Primary image saved.',
        'success'
      );
    } catch (failure) {
      if (!this.current(generation, session)) return;
      this.error.set(apiErrorMessage(failure, 'Image was not changed.'));
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }
  async uploadImage(file: File): Promise<void> {
    const generation = this.generation;
    const session = this.auth.sessionVersion;
    if (this.saving()) return;
    if (this.imageEditBlocked()) {
      this.error.set(
        'Save or discard your field changes before changing images.'
      );
      return;
    }
    if (
      file.size > 5 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    ) {
      this.error.set('Choose PNG, JPEG, or WebP up to 5 MB.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.api.uploadProductImage(
          this.product().id,
          file,
          this.product().inheritanceMode
        )
      );
      if (!this.current(generation, session)) return;
      const updated = await firstValueFrom(this.api.product(this.product().id));
      if (!this.current(generation, session)) return;
      this.syncMedia(updated);
      this.showToast('Product image uploaded.', 'success');
    } catch (failure) {
      if (!this.current(generation, session)) return;
      this.error.set(apiErrorMessage(failure, 'Image was not uploaded.'));
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }

  showToast(
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
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

  identityLocked(field: keyof VendorProductEdit): boolean {
    return (
      this.snapshot()?.approval_status === 'pending_approval' &&
      ![
        'price',
        'comparePrice',
        'stock',
        'lowStockThreshold',
        'minOrderQuantity',
        'prepTimeMinutes',
        'status',
        'availableForSale',
        'instantDelivery',
        'scheduledDelivery',
      ].includes(field)
    );
  }

  validateField(field: keyof VendorProductEdit): void {
    const message = this.validate(this.product())[field];
    this.fieldErrors.update((errors) => {
      const next = { ...errors };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  private validate(product: VendorProductEdit): FieldErrors {
    const errors: FieldErrors = {};
    if (!product.productName?.trim())
      errors['productName'] = 'Product name is required.';
    if (!product.brand?.trim()) errors['brand'] = 'Brand is required.';
    if (!product.unit?.trim()) errors['unit'] = 'Unit is required.';
    if (!product.quantityPackSize?.trim())
      errors['quantityPackSize'] = 'Pack size is required.';
    if (
      product.price === null ||
      product.price === undefined ||
      !Number.isFinite(Number(product.price)) ||
      Number(product.price) <= 0
    )
      errors['price'] = 'Price must be greater than 0.';
    else if (
      Math.abs(
        Number(product.price) * 100 - Math.round(Number(product.price) * 100)
      ) > 0.000001
    )
      errors['price'] = 'Use at most two decimal places for the selling price.';
    if (
      product.stock === null ||
      product.stock === undefined ||
      !Number.isInteger(Number(product.stock)) ||
      Number(product.stock) < 0 ||
      Number(product.stock) > 2147483647
    )
      errors['stock'] =
        'Enter a whole stock quantity between 0 and 2147483647.';
    if (
      !Number.isInteger(Number(product.minOrderQuantity)) ||
      Number(product.minOrderQuantity) < 1
    )
      errors['minOrderQuantity'] = 'Minimum order quantity must be at least 1.';
    if (!product.description?.trim())
      errors['description'] = 'Description is required.';
    // Partial operational edits must not require repairing unchanged legacy identity.
    const previous = this.snapshot();
    if (
      previous &&
      ['approved', 'pending_approval'].includes(previous.approval_status || '')
    ) {
      const saved = mapExistingProductDtoToEdit(previous);
      for (const key of ['brand', 'quantityPackSize', 'description'] as const) {
        if (product[key] === saved[key]) delete errors[key];
      }
    }
    if (!product.instantDelivery && !product.scheduledDelivery)
      errors['instantDelivery'] = 'Enable instant or scheduled delivery.';
    for (const key of ['lowStockThreshold', 'prepTimeMinutes'] as const)
      if (!Number.isInteger(Number(product[key])) || Number(product[key]) < 0)
        errors[key] = 'Enter a non-negative whole number.';
    if (
      product.comparePrice !== null &&
      product.comparePrice !== undefined &&
      Number(product.comparePrice) < Number(product.price)
    )
      errors['comparePrice'] =
        'Compare price must be at least the selling price.';
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
