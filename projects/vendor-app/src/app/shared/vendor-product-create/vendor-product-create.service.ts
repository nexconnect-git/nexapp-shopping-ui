import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import {
  CurrencyService,
  FieldErrors,
  firstFieldError,
  parseFormErrors,
  ToastService,
  VendorApi,
} from '@shared/public-api';
import {
  ApprovedCatalogItem,
  CreateProductStep,
  CreateProductSubmitPayload,
  VendorVariantDraft,
} from './vendor-product-create.models';
import {
  mapApprovedCatalogDtoToItem,
  mapProductDtoToVariantDraft,
  mapVariantDraftToUpdatePayload,
} from './vendor-product-create.mappers';

@Injectable({ providedIn: 'root' })
export class VendorProductCreateService {
  private readonly api = inject(VendorApi);
  private readonly globalToast = inject(ToastService);
  private readonly currency = inject(CurrencyService);

  readonly activeStep = signal<CreateProductStep>('catalog');
  readonly searchQuery = signal('');
  readonly categoryFilter = signal('all');
  readonly selectedCatalogIds = signal<string[]>([]);
  readonly activeVariantIndex = signal(0);
  readonly approvalNote = signal(
    'Kindly review the new variants. Pricing and inventory details are verified. Please let me know if any changes are required.',
  );
  readonly saving = signal(false);
  readonly loadingCatalog = signal(false);
  readonly toast = signal('');
  readonly error = signal('');
  readonly fieldErrors = signal<FieldErrors>({});

  readonly catalogItems = signal<ApprovedCatalogItem[]>([]);
  readonly variants = signal<VendorVariantDraft[]>([]);

  readonly selectedCatalogItems = computed(() => {
    const ids = this.selectedCatalogIds();
    return this.catalogItems().filter((item) => ids.includes(item.id));
  });

  readonly draftedCatalogIds = computed(() =>
    this.variants()
      .map((variant) => variant.catalogId)
      .filter(Boolean),
  );

  readonly newSelectedCatalogIds = computed(() => {
    const drafted = new Set(this.draftedCatalogIds());
    return this.selectedCatalogIds().filter((id) => !drafted.has(id));
  });

  readonly categoryOptions = computed(() => {
    const categories = new Set(
      this.catalogItems()
        .map((item) => item.category)
        .filter(Boolean),
    );
    return ['all', ...Array.from(categories).sort()];
  });

  readonly filteredCatalogItems = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const category = this.categoryFilter();
    return this.catalogItems().filter((item) => {
      const matchesSearch =
        !q ||
        `${item.name} ${item.brand} ${item.category} ${item.unit}`
          .toLowerCase()
          .includes(q);
      const matchesCategory = category === 'all' || item.category === category;
      return matchesSearch && matchesCategory;
    });
  });

  readonly activeVariant = computed(
    () => this.variants()[this.activeVariantIndex()] ?? this.variants()[0],
  );

  readonly priceRange = computed(() => {
    const prices = this.variants()
      .map((variant) => Number(variant.price || 0))
      .filter((price) => price > 0);
    if (!prices.length) return 'Not set';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max
      ? this.formatCurrency(min)
      : `${this.formatCurrency(min)} - ${this.formatCurrency(max)}`;
  });

  readonly totalInventory = computed(() =>
    this.variants().reduce(
      (total, variant) => total + Number(variant.stock || 0),
      0,
    ),
  );

  readonly averagePrice = computed(() => {
    const variants = this.variants();
    if (!variants.length) return this.formatCurrency(0);
    const total = variants.reduce(
      (sum, variant) => sum + Number(variant.price || 0),
      0,
    );
    return this.formatCurrency(total / variants.length);
  });

  readonly readiness = computed(() => {
    const variants = this.variants();
    return [
      {
        label: 'Catalog items selected',
        subtext: `${this.selectedCatalogItems().length} selected`,
        done: this.selectedCatalogItems().length > 0,
      },
      {
        label: 'Variants configured',
        subtext: `${variants.filter((v) => v.price > 0 && v.stock >= 0).length} of ${variants.length} variants`,
        done: variants.length > 0 && variants.every((v) => v.price > 0),
      },
      {
        label: 'Pricing defined',
        subtext: `${variants.filter((v) => v.price > 0).length} of ${variants.length} variants`,
        done: variants.length > 0 && variants.every((v) => v.price > 0),
      },
      {
        label: 'Inventory set',
        subtext: `${variants.filter((v) => v.stock >= 0).length} of ${variants.length} variants`,
        done: variants.length > 0 && variants.every((v) => v.stock >= 0),
      },
      {
        label: 'Required product details complete',
        subtext: 'Brand, unit, pack size, and description are required',
        done:
          variants.length > 0 &&
          variants.every((v) =>
            Boolean(v.brand && v.unit && v.quantityPackSize && v.description),
          ),
      },
    ];
  });

  reset(): void {
    this.activeStep.set('catalog');
    this.searchQuery.set('');
    this.categoryFilter.set('all');
    this.selectedCatalogIds.set([]);
    this.activeVariantIndex.set(0);
    this.variants.set([]);
    this.saving.set(false);
    this.error.set('');
    this.toast.set('');
    this.fieldErrors.set({});
  }

  async loadCatalogItems(search = this.searchQuery()): Promise<void> {
    this.loadingCatalog.set(true);
    this.error.set('');
    try {
      const term = search.trim();
      const response = await firstValueFrom(
        this.api.getVendorAvailableCatalogProducts({
          page_size: 100,
          search: term,
        }),
      );
      const items = Array.isArray(response)
        ? response
        : response?.results || [];
      const selectedItems = this.selectedCatalogItems();
      const byId = new Map<string, ApprovedCatalogItem>();
      [...selectedItems, ...items.map(mapApprovedCatalogDtoToItem)].forEach(
        (item) => byId.set(item.id, item),
      );
      this.catalogItems.set(Array.from(byId.values()));
    } catch {
      this.error.set(
        'Failed to load approved catalog items. Refresh and try again.',
      );
      this.showToast('Failed to load approved catalog items.', 'error');
    } finally {
      this.loadingCatalog.set(false);
    }
  }

  async applyFilters(): Promise<void> {
    await this.loadCatalogItems(this.searchQuery());
    if (!this.error()) {
      this.showToast(
        `${this.filteredCatalogItems().length} catalog item${this.filteredCatalogItems().length === 1 ? '' : 's'} match your filters.`,
        'info',
      );
    }
  }

  toggleCatalog(id: string): void {
    const isDrafted = this.draftedCatalogIds().includes(id);
    const current = this.selectedCatalogIds();
    if (current.includes(id)) {
      if (isDrafted) {
        this.showToast(
          'This item already has a variant draft. Remove the variant to deselect it.',
          'info',
        );
        return;
      }
      this.selectedCatalogIds.set(current.filter((item) => item !== id));
      return;
    }

    this.selectedCatalogIds.set([...current, id]);
    this.error.set('');
  }

  removeSelectedCatalog(id: string): void {
    this.toggleCatalog(id);
  }

  setStep(step: CreateProductStep, variantIndex?: number): void {
    if (step !== 'catalog' && !this.variants().length) return;
    if (
      (step === 'variant-1' || step === 'variant-2') &&
      typeof variantIndex === 'number'
    ) {
      this.activeVariantIndex.set(
        Math.min(variantIndex, Math.max(0, this.variants().length - 1)),
      );
      this.activeStep.set(variantIndex <= 0 ? 'variant-1' : 'variant-2');
      this.error.set('');
      this.fieldErrors.set({});
      return;
    }
    if (step === 'review') {
      if (this.newSelectedCatalogIds().length) {
        this.error.set(
          'Create variant drafts for newly selected catalog items before review.',
        );
        this.showToast(this.error(), 'error');
        return;
      }
      if (!this.validateAllVariants()) return;
    }
    this.error.set('');
    this.activeStep.set(step);
  }

  async next(): Promise<void> {
    const step = this.activeStep();
    if (step === 'catalog') {
      await this.createVariantDrafts();
      return;
    }

    if (step === 'variant-1') {
      if (!(await this.saveDraft())) return;
      this.moveToNextVariantOrReview();
      return;
    }

    if (step === 'variant-2') {
      if (!(await this.saveDraft())) return;
      this.moveToNextVariantOrReview();
    }
  }

  back(): void {
    if (this.activeStep() === 'review') {
      const lastVariantIndex = Math.max(0, this.variants().length - 1);
      this.activeVariantIndex.set(lastVariantIndex);
      this.activeStep.set(lastVariantIndex > 0 ? 'variant-2' : 'variant-1');
      return;
    }

    if (
      this.activeStep() === 'variant-2' ||
      this.activeStep() === 'variant-1'
    ) {
      const previousIndex = this.activeVariantIndex() - 1;
      if (previousIndex >= 0) {
        this.activeVariantIndex.set(previousIndex);
        this.activeStep.set(previousIndex > 0 ? 'variant-2' : 'variant-1');
      } else {
        this.activeStep.set('catalog');
      }
      return;
    }
  }

  updateVariant(patch: Partial<VendorVariantDraft>): void {
    const index = this.activeVariantIndex();
    const variants = [...this.variants()];
    if (!variants[index]) return;
    variants[index] = { ...variants[index], ...patch };
    this.variants.set(variants);
    this.clearFieldErrors(Object.keys(patch));
  }

  async duplicateActiveVariant(): Promise<void> {
    const active = this.activeVariant();
    if (!active) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const duplicate = await firstValueFrom(
        this.api.duplicateInheritedProduct(active.id),
      );
      this.variants.set([
        ...this.variants(),
        mapProductDtoToVariantDraft(duplicate),
      ]);
      this.activeVariantIndex.set(this.variants().length - 1);
      this.activeStep.set(
        this.activeVariantIndex() > 0 ? 'variant-2' : 'variant-1',
      );
      this.showToast('Variant duplicated', 'success');
    } catch (err: any) {
      this.showError(err, 'Duplicate failed.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeActiveVariant(): Promise<void> {
    const active = this.activeVariant();
    const variants = this.variants();
    if (!active) return;
    if (variants.length <= 1) {
      this.showToast('At least one variant is required', 'info');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.deleteProduct(active.id));
      const remaining = variants.filter((variant) => variant.id !== active.id);
      this.variants.set(remaining);
      this.selectedCatalogIds.set(
        remaining.map((variant) => variant.catalogId).filter(Boolean),
      );
      const nextIndex = Math.min(
        this.activeVariantIndex(),
        remaining.length - 1,
      );
      this.activeVariantIndex.set(nextIndex);
      this.activeStep.set(nextIndex > 0 ? 'variant-2' : 'variant-1');
      this.showToast('Variant removed', 'success');
    } catch (err: any) {
      this.showError(err, 'Failed to remove variant.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveDraft(): Promise<boolean> {
    const active = this.activeVariant();
    if (!active) return false;
    const validation = this.validateVariant(active);
    if (Object.keys(validation).length) {
      const message = firstFieldError(
        validation,
        'Fix the highlighted variant fields.',
      );
      this.fieldErrors.set(validation);
      this.error.set(message);
      this.showToast(message, 'error');
      return false;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      const updated = await firstValueFrom(
        this.api.updateInheritedProduct(
          active.id,
          mapVariantDraftToUpdatePayload(active),
        ),
      );
      const draft = mapProductDtoToVariantDraft(updated);
      this.variants.update((items) =>
        items.map((item) => (item.id === draft.id ? draft : item)),
      );
      this.showToast('Draft saved', 'success');
      return true;
    } catch (err: any) {
      this.showError(err, 'Failed to save draft.');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  async submitForApproval(): Promise<CreateProductSubmitPayload> {
    if (!this.validateAllVariants()) {
      throw new Error(
        this.error() || 'Fix validation errors before submitting.',
      );
    }

    this.saving.set(true);
    this.error.set('');
    try {
      await Promise.all(
        this.variants().map((variant) =>
          firstValueFrom(
            this.api.updateInheritedProduct(
              variant.id,
              mapVariantDraftToUpdatePayload(variant),
            ),
          ),
        ),
      );
      const response = await firstValueFrom(
        this.api.submitInheritedProducts(
          this.variants().map((variant) => variant.id),
        ),
      );
      const submitted = Array.isArray(response)
        ? response
        : response?.variants || [];
      if (submitted.length)
        this.variants.set(submitted.map(mapProductDtoToVariantDraft));
      this.showToast('Submitted for admin approval', 'success');
      return {
        selectedCatalogItems: this.selectedCatalogItems(),
        variants: this.variants(),
        approvalNote: this.approvalNote(),
      };
    } catch (err: any) {
      this.showError(
        err,
        'Fix validation errors before submitting for approval.',
      );
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  async discardDrafts(): Promise<boolean> {
    const ids = this.variants().map((variant) => variant.id);
    if (!ids.length) return true;
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm('Discard all unsubmitted variant drafts?');
    if (!confirmed) return false;
    this.saving.set(true);
    try {
      await firstValueFrom(
        forkJoin(ids.map((id) => this.api.deleteProduct(id))),
      );
      this.reset();
      this.showToast('Draft variants discarded.', 'success');
      return true;
    } catch {
      this.showToast(
        'Some drafts could not be discarded. Please remove them individually.',
        'error',
      );
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async createVariantDrafts(): Promise<void> {
    if (!this.selectedCatalogIds().length) {
      this.error.set('Select at least one approved catalog item.');
      return;
    }

    const idsToCreate = this.newSelectedCatalogIds();
    if (!idsToCreate.length) {
      this.activeVariantIndex.set(
        Math.min(
          this.activeVariantIndex(),
          Math.max(0, this.variants().length - 1),
        ),
      );
      this.activeStep.set(
        this.activeVariantIndex() > 0 ? 'variant-2' : 'variant-1',
      );
      this.showToast(
        'No new catalog items selected. Continue editing your existing variants.',
        'info',
      );
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.api.createInheritedProductDraftBatch(idsToCreate),
      );
      const drafts = Array.isArray(response)
        ? response
        : response?.variants || [];
      if (!drafts.length) {
        this.error.set(
          'No variant drafts were created. Refresh catalog items and try again.',
        );
        this.showToast(this.error(), 'error');
        return;
      }
      const mappedDrafts = drafts.map(mapProductDtoToVariantDraft);
      const existingVariants = this.variants();
      this.variants.set([...existingVariants, ...mappedDrafts]);
      this.selectedCatalogIds.set(
        this.variants()
          .map((variant) => variant.catalogId)
          .filter(Boolean),
      );
      this.activeVariantIndex.set(existingVariants.length);
      this.activeStep.set(
        existingVariants.length > 0 ? 'variant-2' : 'variant-1',
      );
      this.showToast(
        `${drafts.length} variant draft${drafts.length === 1 ? '' : 's'} ready to edit.`,
        'success',
      );
    } catch (err: any) {
      this.showError(err, 'Could not create variant drafts.');
    } finally {
      this.saving.set(false);
    }
  }

  private validateAllVariants(): boolean {
    for (const variant of this.variants()) {
      const errors = this.validateVariant(variant);
      if (Object.keys(errors).length) {
        const index = this.variants().findIndex(
          (item) => item.id === variant.id,
        );
        if (index >= 0) {
          this.activeVariantIndex.set(index);
          this.activeStep.set(index > 0 ? 'variant-2' : 'variant-1');
        }
        const message = firstFieldError(
          errors,
          'Fix the highlighted variant fields.',
        );
        this.fieldErrors.set(errors);
        this.error.set(message);
        this.showToast(message, 'error');
        return false;
      }
    }
    return true;
  }

  private validateVariant(variant: VendorVariantDraft): FieldErrors {
    const errors: FieldErrors = {};
    if (!variant.productName?.trim())
      errors['productName'] = 'Product name is required.';
    if (!variant.brand?.trim()) errors['brand'] = 'Brand is required.';
    if (!variant.unit?.trim()) errors['unit'] = 'Unit is required.';
    if (!variant.quantityPackSize?.trim())
      errors['quantityPackSize'] = 'Pack size is required.';
    if (Number(variant.price) <= 0)
      errors['price'] = 'Price must be greater than 0.';
    if (Number(variant.stock) < 0)
      errors['stock'] = 'Stock cannot be negative.';
    if (!variant.description?.trim())
      errors['description'] = 'Description is required.';
    return errors;
  }

  private showError(err: any, fallback: string): void {
    const parsed = parseFormErrors(
      err?.error,
      this.apiFieldMap,
      this.friendlyApiMessages,
    );
    const message = parsed.summary || fallback;
    this.fieldErrors.set(parsed.fieldErrors);
    this.error.set(message);
    this.showToast(message, 'error');
  }

  private formatCurrency(value: number): string {
    return this.currency.format(value);
  }

  showToast(
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
  ): void {
    this.toast.set(message);
    this.globalToast.show(message, type);
    window.setTimeout(() => this.toast.set(''), 2200);
  }

  visibleStepItems(): Array<{ label: string; created: boolean }> {
    const variants = this.variants();
    const drafted = new Set(variants.map((variant) => variant.catalogId));
    const created = variants.map((variant) => ({
      label: variant.productName,
      created: true,
    }));
    const pending = this.selectedCatalogItems()
      .filter((item) => !drafted.has(item.id))
      .map((item) => ({ label: item.name, created: false }));
    return [...created, ...pending];
  }

  variantStepLabel(index: number): string {
    return (
      this.variants()[index]?.productName ||
      this.selectedCatalogItems()[index]?.name ||
      `Variant ${index + 1}`
    );
  }

  variantStepCaption(index: number): string {
    if (!this.variants().length) return 'Create draft first';
    if (!this.variants()[index]) return 'Not created';
    return this.activeVariantIndex() > index || this.activeStep() === 'review'
      ? 'Variant saved'
      : 'Customize variant';
  }

  catalogPrimaryActionLabel(): string {
    if (this.saving()) return 'Creating...';
    if (!this.variants().length) return 'Create Variant Steps';
    if (this.newSelectedCatalogIds().length) return 'Add Variant Steps';
    return 'Continue Editing';
  }

  fieldError(field: keyof VendorVariantDraft | 'availability'): string {
    return this.fieldErrors()[field] || '';
  }

  clearFieldErrors(fields: string[]): void {
    if (!fields.length) return;
    const current = { ...this.fieldErrors() };
    fields.forEach((field) => {
      delete current[field];
      if (field === 'availability') delete current['status'];
    });
    this.fieldErrors.set(current);
    if (!Object.keys(current).length) this.error.set('');
  }

  variantTagOptions(): string[] {
    const active = this.activeVariant();
    if (!active) return ['Featured', 'Popular', 'Fresh', 'Fast moving'];
    const catalogItem = this.catalogItems().find(
      (item) => item.id === active.catalogId,
    );

    const words = [
      catalogItem?.category,
      active.brand,
      active.unit,
      active.availability,
      active.stock > 0 ? 'In stock' : 'Restock needed',
      active.visibleOnStore ? 'Visible on store' : 'Hidden from store',
    ]
      .filter(Boolean)
      .map((value) => String(value));

    return Array.from(new Set([...words, 'Featured', 'Popular'])).slice(0, 8);
  }

  private moveToNextVariantOrReview(): void {
    const nextIndex = this.activeVariantIndex() + 1;
    if (nextIndex < this.variants().length) {
      this.activeVariantIndex.set(nextIndex);
      this.activeStep.set(nextIndex > 0 ? 'variant-2' : 'variant-1');
      return;
    }
    if (this.validateAllVariants()) this.activeStep.set('review');
  }

  private readonly apiFieldMap: Record<string, string> = {
    name: 'productName',
    weight: 'quantityPackSize',
    compare_price: 'comparePrice',
    prep_time_minutes: 'prepTime',
    packaging_instructions: 'packagingNotes',
    shelf_life: 'shelfLife',
    search_keywords: 'tags',
    is_available: 'visibleOnStore',
    is_instant_delivery: 'requiresShipping',
    status: 'availability',
  };

  private readonly friendlyApiMessages: Record<string, string> = {
    status: 'Choose a valid availability option for this variant.',
    price: 'Enter a selling price greater than 0.',
    stock: 'Enter a valid stock quantity.',
    weight: 'Enter the pack size customers will see.',
    name: 'Product name is required.',
    brand: 'Brand is required.',
    unit: 'Unit is required.',
    description: 'Description is required.',
  };
}
