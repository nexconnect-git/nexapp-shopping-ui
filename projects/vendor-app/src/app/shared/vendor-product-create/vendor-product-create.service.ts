import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  apiErrorMessage,
  AuthService,
  FieldErrors,
  Product,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { firstValueFrom } from 'rxjs';
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
  private readonly api = inject(VendorWorkspaceApi);
  private readonly auth = inject(AuthService);
  private owner = '';
  private sessionGeneration = 0;
  private draftGeneration = 0;
  private catalogGeneration = 0;
  private batchKey = '';
  private batchSelection = '';
  readonly activeStep = signal<CreateProductStep>('catalog');
  readonly searchQuery = signal('');
  readonly requestedCatalogId = signal('');
  readonly catalogPage = signal(1);
  readonly catalogCount = signal(0);
  readonly selectedCatalogIds = signal<string[]>([]);
  readonly activeVariantIndex = signal(0);
  readonly approvalNote = signal('');
  readonly saving = signal(false);
  readonly loadingCatalog = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<FieldErrors>({});
  readonly catalogItems = signal<ApprovedCatalogItem[]>([]);
  readonly selectedItems = signal<ReadonlyMap<string, ApprovedCatalogItem>>(
    new Map()
  );
  readonly variants = signal<VendorVariantDraft[]>([]);
  readonly saved = signal<ReadonlyMap<string, string>>(new Map());
  readonly submittedIds = signal<ReadonlySet<string>>(new Set());
  readonly itemErrors = signal<ReadonlyMap<string, string>>(new Map());
  readonly draftRows = signal<Product[]>([]);
  readonly draftPage = signal(1);
  readonly draftCount = signal(0);
  readonly draftsLoading = signal(false);
  readonly success = signal('');
  readonly selectedCatalogItems = computed(() =>
    this.selectedCatalogIds()
      .map((id) => this.selectedItems().get(id))
      .filter((item): item is ApprovedCatalogItem => !!item)
  );
  readonly filteredCatalogItems = this.catalogItems;
  readonly draftedCatalogIds = computed(() =>
    this.variants().map((variant) => variant.catalogId)
  );
  readonly newSelectedCatalogIds = computed(() =>
    this.selectedCatalogIds().filter(
      (id) => !this.draftedCatalogIds().includes(id)
    )
  );
  readonly activeVariant = computed(
    () => this.variants()[this.activeVariantIndex()]
  );
  readonly dirty = computed(() =>
    this.variants().some(
      (variant) =>
        !this.submittedIds().has(variant.id) &&
        this.saved().get(variant.id) !== this.signature(variant)
    )
  );
  readonly totalInventory = computed(() =>
    this.variants().reduce((total, item) => total + Number(item.stock || 0), 0)
  );
  constructor() {
    effect(() => {
      const owner = this.auth.user()?.id || '';
      if (owner !== this.owner) {
        this.owner = owner;
        this.reset();
      }
    });
  }
  private current(generation: number, session: number): boolean {
    return (
      generation === this.sessionGeneration &&
      session === this.auth.sessionVersion
    );
  }
  reset(): void {
    this.sessionGeneration++;
    this.draftGeneration++;
    this.catalogGeneration++;
    this.catalogItems.set([]);
    this.draftRows.set([]);
    this.draftCount.set(0);
    this.catalogCount.set(0);
    this.saving.set(false);
    this.loadingCatalog.set(false);
    this.draftsLoading.set(false);
    this.activeStep.set('catalog');
    this.selectedCatalogIds.set([]);
    this.selectedItems.set(new Map());
    this.variants.set([]);
    this.saved.set(new Map());
    this.submittedIds.set(new Set());
    this.activeVariantIndex.set(0);
    this.approvalNote.set('');
    this.error.set('');
    this.success.set('');
    this.itemErrors.set(new Map());
    this.batchKey = '';
  }
  async loadCatalogItems(
    search = this.searchQuery(),
    page = this.catalogPage()
  ): Promise<void> {
    const generation = ++this.catalogGeneration;
    this.loadingCatalog.set(true);
    try {
      const result = await firstValueFrom(
        this.api.catalog({
          search,
          page,
          catalog_id: this.requestedCatalogId() || undefined,
        })
      );
      if (generation !== this.catalogGeneration) return;
      this.catalogPage.set(page);
      this.catalogCount.set(result.count);
      this.catalogItems.set(result.results.map(mapApprovedCatalogDtoToItem));
    } catch (failure) {
      if (generation === this.catalogGeneration)
        this.error.set(
          apiErrorMessage(failure, 'Catalog could not be loaded.')
        );
    } finally {
      if (generation === this.catalogGeneration) this.loadingCatalog.set(false);
    }
  }
  async loadDrafts(page = this.draftPage()): Promise<void> {
    const generation = ++this.draftGeneration;
    const session = this.auth.sessionVersion;
    this.draftsLoading.set(true);
    try {
      const result = await firstValueFrom(this.api.drafts({ page }));
      if (
        generation !== this.draftGeneration ||
        session !== this.auth.sessionVersion
      )
        return;
      this.draftPage.set(page);
      this.draftCount.set(result.count);
      this.draftRows.set(result.results);
    } catch (failure) {
      if (
        generation !== this.draftGeneration ||
        session !== this.auth.sessionVersion
      )
        return;
      this.error.set(
        apiErrorMessage(failure, 'Saved drafts could not be loaded.')
      );
    } finally {
      if (
        generation === this.draftGeneration &&
        session === this.auth.sessionVersion
      )
        this.draftsLoading.set(false);
    }
  }
  async applyFilters(): Promise<void> {
    this.requestedCatalogId.set('');
    await this.loadCatalogItems(this.searchQuery(), 1);
  }
  toggleCatalog(id: string): void {
    if (this.saving()) return;
    const selected = this.selectedCatalogIds();
    if (selected.includes(id)) {
      if (this.draftedCatalogIds().includes(id)) {
        this.error.set(
          'A saved variant uses this catalog item. Remove that variant first.'
        );
        return;
      }
      this.selectedCatalogIds.set(selected.filter((value) => value !== id));
    } else {
      const item = this.catalogItems().find((item) => item.id === id);
      if (item)
        this.selectedItems.update((items) => new Map(items).set(id, item));
      this.selectedCatalogIds.set([...selected, id]);
    }
    this.error.set('');
  }
  resume(product: Product): void {
    if (!this.variants().some((item) => item.id === product.id)) {
      this.approvalNote.set(product.approval_note || this.approvalNote());
      const draft = mapProductDtoToVariantDraft(product);
      this.variants.update((items) => [...items, draft]);
      this.saved.update((items) =>
        new Map(items).set(draft.id, this.signature(draft))
      );
      if (product.catalog_product) {
        const item = mapApprovedCatalogDtoToItem(product.catalog_product);
        this.selectedItems.update((items) => new Map(items).set(item.id, item));
        this.selectedCatalogIds.update((ids) => [
          ...new Set([...ids, item.id]),
        ]);
      }
    }
    this.activeVariantIndex.set(
      this.variants().findIndex((item) => item.id === product.id)
    );
    this.activeStep.set('variants');
  }
  setStep(step: CreateProductStep, index?: number): void {
    if (this.saving()) return;
    if (index !== undefined)
      this.activeVariantIndex.set(
        Math.max(0, Math.min(index, this.variants().length - 1))
      );
    if (step !== 'catalog' && !this.variants().length) return;
    if (step === 'review' && !this.validateAll()) return;
    this.activeStep.set(step);
    this.fieldErrors.set({});
    this.error.set('');
  }
  back(): void {
    if (this.activeStep() === 'review') {
      this.activeVariantIndex.set(Math.max(0, this.variants().length - 1));
      this.activeStep.set('fulfillment');
    } else if (this.activeStep() === 'fulfillment') {
      this.activeStep.set('variants');
    } else if (this.activeVariantIndex() > 0)
      this.activeVariantIndex.update((index) => index - 1);
    else this.activeStep.set('catalog');
  }
  async next(): Promise<void> {
    if (this.saving()) return;
    if (this.activeStep() === 'catalog') {
      await this.createDrafts();
      return;
    }
    if (await this.saveDraft()) {
      if (this.activeVariantIndex() < this.variants().length - 1)
        this.activeVariantIndex.update((index) => index + 1);
      else {
        const enteringFulfillment = this.activeStep() === 'variants';
        this.setStep(enteringFulfillment ? 'fulfillment' : 'review', enteringFulfillment ? 0 : undefined);
      }
    }
  }
  updateVariant(patch: Partial<VendorVariantDraft>): void {
    const id = this.activeVariant()?.id;
    if (!id || this.submittedIds().has(id) || this.saving()) return;
    this.variants.update((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    this.fieldErrors.set({});
    this.success.set('');
    this.itemErrors.update((errors) => {
      const remaining = new Map(errors);
      remaining.delete(id);
      return remaining;
    });
  }
  private async createDrafts(): Promise<void> {
    const generation = this.sessionGeneration;
    const session = this.auth.sessionVersion;
    const ids = this.newSelectedCatalogIds();
    if (!ids.length) {
      if (this.variants().length) this.activeStep.set('variants');
      else this.error.set('Select at least one approved catalog item.');
      return;
    }
    const selection = [...ids].sort().join(',');
    if (this.batchSelection !== selection || !this.batchKey) {
      this.batchSelection = selection;
      this.batchKey = crypto.randomUUID();
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.api.createDraftBatch(ids, this.batchKey)
      );
      if (!this.current(generation, session)) return;
      result.variants.forEach((product) => this.resume(product));
      if (result.variants.length)
        this.activeVariantIndex.set(this.variants().findIndex(variant => variant.id === result.variants[0].id));
      this.success.set(
        `${result.variants.length} drafts saved. Configure their details before submission.`
      );
      this.batchKey = '';
      await this.loadDrafts();
    } catch (failure) {
      if (!this.current(generation, session)) return;
      this.error.set(
        apiErrorMessage(
          failure,
          'Draft batch could not be created. Your selection remains available to retry.'
        )
      );
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }
  async duplicateActiveVariant(): Promise<void> {
    const generation = this.sessionGeneration;
    const session = this.auth.sessionVersion;
    const active = this.activeVariant();
    if (!active || this.saving()) return;
    this.saving.set(true);
    try {
      const duplicated = await firstValueFrom(
        this.api.duplicateDraft(active.id)
      );
      if (!this.current(generation, session)) return;
      this.resume(duplicated);
      this.success.set(
        'Duplicate draft saved. Adjust its pack size, brand, or unit to make a distinct variant.'
      );
    } catch (failure) {
      if (!this.current(generation, session)) return;
      this.error.set(
        apiErrorMessage(failure, 'Could not duplicate this variant.')
      );
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }
  async removeActiveVariant(): Promise<void> {
    const generation = this.sessionGeneration;
    const session = this.auth.sessionVersion;
    const active = this.activeVariant();
    if (!active || this.saving()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.deleteProduct(active.id));
      if (!this.current(generation, session)) return;
      this.variants.update((items) =>
        items.filter((item) => item.id !== active.id)
      );
      this.activeVariantIndex.set(
        Math.max(
          0,
          Math.min(this.activeVariantIndex(), this.variants().length - 1)
        )
      );
      if (!this.variants().some((item) => item.catalogId === active.catalogId))
        this.selectedCatalogIds.update((ids) =>
          ids.filter((id) => id !== active.catalogId)
        );
      if (!this.variants().length) this.activeStep.set('catalog');
      this.success.set('Draft removed.');
      await this.loadDrafts();
    } catch (failure) {
      if (!this.current(generation, session)) return;
      this.error.set(apiErrorMessage(failure, 'Draft was not removed.'));
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }
  async saveDraft(): Promise<boolean> {
    const generation = this.sessionGeneration;
    const session = this.auth.sessionVersion;
    const active = this.activeVariant();
    if (!active || this.saving() || this.submittedIds().has(active.id))
      return false;
    const errors = this.validate(active);
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      this.error.set('Correct the highlighted fields before saving.');
      return false;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const updated = await firstValueFrom(
        this.api.updateDraft(active.id, {
          ...mapVariantDraftToUpdatePayload(active),
          approval_note: this.approvalNote(),
        })
      );
      if (!this.current(generation, session)) return false;
      const draft = mapProductDtoToVariantDraft(updated);
      this.variants.update((items) =>
        items.map((item) => (item.id === draft.id ? draft : item))
      );
      this.saved.update((items) =>
        new Map(items).set(draft.id, this.signature(draft))
      );
      this.success.set('Draft saved. It remains hidden until admin approval.');
      return true;
    } catch (failure) {
      if (!this.current(generation, session)) return false;
      this.error.set(
        apiErrorMessage(
          failure,
          'Draft was not saved. Your edits remain in this form.'
        )
      );
      return false;
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }
  async upload(file: File): Promise<void> {
    const generation = this.sessionGeneration;
    const session = this.auth.sessionVersion;
    const active = this.activeVariant();
    if (!active || this.saving()) return;
    if (
      file.size > 5 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    ) {
      this.error.set('Choose a PNG, JPEG, or WebP image up to 5 MB.');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.uploadProductImage(active.id, file, active.inheritanceMode)
      );
      if (!this.current(generation, session)) return;
      const product = await firstValueFrom(this.api.product(active.id));
      if (!this.current(generation, session)) return;
      this.updateImage(product);
      this.success.set('Image uploaded.');
    } catch (failure) {
      if (!this.current(generation, session)) return;
      this.error.set(apiErrorMessage(failure, 'Image could not be uploaded.'));
    } finally {
      if (this.current(generation, session)) this.saving.set(false);
    }
  }
  private updateImage(product: Product): void {
    const image = mapProductDtoToVariantDraft(product).imageUrl;
    this.variants.update((items) =>
      items.map((item) =>
        item.id === product.id ? { ...item, imageUrl: image } : item
      )
    );
  }
  async submitForApproval(): Promise<CreateProductSubmitPayload> {
    const generation = this.sessionGeneration;
    const session = this.auth.sessionVersion;
    if (this.saving() || !this.validateAll())
      throw new Error('Correct variant validation first.');
    this.saving.set(true);
    this.error.set('');
    this.itemErrors.set(new Map());
    this.success.set('');
    const failures = new Map<string, string>();
    for (const draft of this.variants()) {
      if (this.submittedIds().has(draft.id)) continue;
      try {
        const updated = await firstValueFrom(
          this.api.updateDraft(draft.id, {
            ...mapVariantDraftToUpdatePayload(draft),
            approval_note: this.approvalNote(),
          })
        );
        if (!this.current(generation, session))
          throw new Error('Session changed during submission.');
        this.saved.update((items) =>
          new Map(items).set(
            draft.id,
            this.signature(mapProductDtoToVariantDraft(updated))
          )
        );
        const response = await firstValueFrom(
          this.api.submitDrafts([draft.id], this.approvalNote())
        );
        if (!this.current(generation, session))
          throw new Error('Session changed during submission.');
        if (
          response.length !== 1 ||
          response[0].approval_status !== 'pending_approval'
        )
          throw new Error('Submission was not confirmed by the server.');
        this.submittedIds.update((ids) => new Set(ids).add(draft.id));
      } catch (failure) {
        if (!this.current(generation, session))
          throw new Error('Session changed during submission.');
        failures.set(
          draft.id,
          apiErrorMessage(failure, 'Variant was not submitted.')
        );
      }
    }
    this.saving.set(false);
    this.itemErrors.set(failures);
    if (failures.size) {
      this.error.set(
        `${failures.size} variants remain unsubmitted. Successful submissions are preserved; retry only the remaining variants.`
      );
      throw new Error(this.error());
    }
    const payload = {
      selectedCatalogItems: this.selectedCatalogItems(),
      variants: this.variants(),
      approvalNote: this.approvalNote(),
    };
    this.success.set('All variants submitted for admin approval.');
    this.reset();
    return payload;
  }
  fieldError(field: keyof VendorVariantDraft): string {
    return this.fieldErrors()[field] || '';
  }
  private signature(variant: VendorVariantDraft): string {
    return JSON.stringify({
      ...mapVariantDraftToUpdatePayload(variant),
      approval_note: this.approvalNote(),
    });
  }
  variantDirty(variant: VendorVariantDraft): boolean {
    return this.saved().get(variant.id) !== this.signature(variant);
  }
  private validate(variant: VendorVariantDraft): FieldErrors {
    const errors: FieldErrors = {};
    if (!variant.productName.trim())
      errors['productName'] = 'Name is required.';
    if (!variant.brand.trim()) errors['brand'] = 'Brand is required.';
    if (!variant.quantityPackSize.trim())
      errors['quantityPackSize'] = 'Pack size is required.';
    if (!variant.description.trim())
      errors['description'] = 'Description is required.';
    if (!Number.isFinite(Number(variant.price)) || Number(variant.price) <= 0)
      errors['price'] = 'Enter a positive price.';
    if (
      !Number.isInteger(Number(variant.stock)) ||
      Number(variant.stock) < 0 ||
      Number(variant.stock) > 2147483647
    )
      errors['stock'] = 'Enter a whole stock quantity from 0 to 2147483647.';
    if (
      variant.comparePrice !== null &&
      variant.comparePrice !== undefined &&
      Number(variant.comparePrice) < Number(variant.price)
    )
      errors['comparePrice'] =
        'Compare price must be at least the selling price.';
    if (!/^[0-9]+$/.test(variant.prepTime))
      errors['prepTime'] = 'Enter preparation time as whole minutes.';
    if (!variant.instantDelivery && !variant.scheduledDelivery)
      errors['instantDelivery'] =
        'Enable at least one supported delivery mode.';
    return errors;
  }
  private validateAll(): boolean {
    for (let index = 0; index < this.variants().length; index++) {
      const draft = this.variants()[index];
      if (this.submittedIds().has(draft.id)) continue;
      const errors = this.validate(draft);
      if (Object.keys(errors).length) {
        this.fieldErrors.set(errors);
        this.activeVariantIndex.set(index);
        this.activeStep.set('variants');
        this.error.set('Correct the highlighted variant fields.');
        return false;
      }
    }
    return this.variants().length > 0;
  }
}
