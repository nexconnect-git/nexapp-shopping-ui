import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, CatalogProduct, Product, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss'
})
export class ProductFormComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  editMode = signal(false);
  editProductId: string | null = null;
  editProduct = signal<Product | null>(null);
  submitting = signal(false);
  formError = signal('');
  catalogProducts = signal<CatalogProduct[]>([]);
  catalogLoading = signal(false);
  catalogSearch = signal('');
  selectedCatalogIds = signal<string[]>([]);
  currentStep = signal(0);
  variantDrafts = signal<Product[]>([]);
  creatingDrafts = signal(false);
  saving = signal(false);
  deletingVariantId = signal<string | null>(null);
  editForm = signal({
    name: '',
    description: '',
    brand: '',
    unit: 'piece',
    weight: '',
    barcode: '',
    sku: '',
    price: 0,
    compare_price: null as number | null,
    stock: 0,
    low_stock_threshold: 10,
    min_order_quantity: 1,
    is_available: true,
    status: 'active',
    prep_time_minutes: 0,
    is_instant_delivery: true,
    is_scheduled_delivery: true,
    ingredients: '',
    allergens: '',
    shelf_life: '',
    compliance_notes: '',
    packaging_instructions: '',
    is_perishable: false,
    requires_cold_storage: false,
    is_fragile: false,
    is_age_restricted: false,
    is_returnable: true,
  });

  readonly crucialEditFields = [
    'name', 'description', 'brand', 'unit', 'weight', 'barcode', 'sku',
    'ingredients', 'allergens', 'shelf_life', 'compliance_notes',
    'packaging_instructions', 'is_perishable', 'requires_cold_storage',
    'is_fragile', 'is_age_restricted', 'is_returnable',
  ];

  changedCrucialFields = computed(() => {
    const product = this.editProduct();
    if (!product) return [];
    const form: any = this.editForm();
    return this.crucialEditFields.filter(field => String((product as any)[field] ?? '') !== String(form[field] ?? ''));
  });

  reviewWarning = computed(() => {
    const product = this.editProduct();
    if (!product || this.changedCrucialFields().length === 0) return '';
    if (product.approval_status === 'approved') {
      return 'These changes require admin approval. Product will be hidden from customers until approved.';
    }
    if (product.approval_status === 'rejected') {
      return 'Saving these changes will resubmit the product for admin approval.';
    }
    if (product.approval_status === 'pending_approval') {
      return 'This product is already waiting for admin approval. These changes will update the review request.';
    }
    return '';
  });

  canSubmitEditForApproval = computed(() => {
    const product = this.editProduct();
    return product?.approval_status === 'draft' || product?.approval_status === 'rejected';
  });

  filteredCatalogProducts = computed(() => {
    const term = this.catalogSearch().trim().toLowerCase();
    if (!term) return this.catalogProducts();
    return this.catalogProducts().filter(item =>
      item.name.toLowerCase().includes(term) ||
      (item.brand || '').toLowerCase().includes(term) ||
      (item.category?.name || '').toLowerCase().includes(term)
    );
  });

  dynamicSteps = computed(() => {
    const steps: string[] = ['Catalog Select'];
    this.variantDrafts().forEach((item, index) => {
      steps.push(`${index + 1}. ${item.catalog_product?.name || item.name}`);
    });
    steps.push('Review & Submit');
    return steps;
  });

  currentVariant = computed(() => {
    const step = this.currentStep();
    if (step <= 0 || step > this.variantDrafts().length) return null;
    return this.variantDrafts()[step - 1];
  });

  selectedCatalogProducts = computed(() =>
    this.catalogProducts().filter(item => this.selectedCatalogIds().includes(item.id))
  );

  isReviewStep = computed(() => this.currentStep() === this.dynamicSteps().length - 1);

  canStartStepper = computed(() =>
    this.selectedCatalogIds().length > 0 && !this.creatingDrafts()
  );

  canGoBack = computed(() => this.currentStep() > 0);

  canGoNext = computed(() =>
    this.currentStep() > 0 && this.currentStep() < this.dynamicSteps().length - 1
  );

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode.set(true);
      this.editProductId = id;
      this.loadEditProduct(id);
      return;
    }
    this.loadCatalogProducts();
  }

  private loadEditProduct(id: string) {
    this.api.getVendorProduct(id).subscribe({
      next: (product) => {
        this.editProduct.set(product);
        localStorage.setItem(`vendor_product_name_${id}`, product.name || 'Product');
        this.editForm.set({
          name: product.name || '',
          description: product.description || '',
          brand: product.brand || '',
          unit: product.unit || 'piece',
          weight: product.weight || '',
          barcode: product.barcode || '',
          sku: product.sku || '',
          price: Number(product.price || 0),
          compare_price: product.compare_price !== null && product.compare_price !== undefined ? Number(product.compare_price) : null,
          stock: Number(product.stock || 0),
          low_stock_threshold: Number(product.low_stock_threshold || 0),
          min_order_quantity: Number(product.min_order_quantity || 1),
          is_available: !!product.is_available,
          status: product.status || 'active',
          prep_time_minutes: Number(product.prep_time_minutes || 0),
          is_instant_delivery: product.is_instant_delivery ?? true,
          is_scheduled_delivery: product.is_scheduled_delivery ?? true,
          ingredients: product.ingredients || '',
          allergens: product.allergens || '',
          shelf_life: product.shelf_life || '',
          compliance_notes: product.compliance_notes || '',
          packaging_instructions: product.packaging_instructions || '',
          is_perishable: product.is_perishable ?? false,
          requires_cold_storage: product.requires_cold_storage ?? false,
          is_fragile: product.is_fragile ?? false,
          is_age_restricted: product.is_age_restricted ?? false,
          is_returnable: product.is_returnable ?? true,
        });
      },
      error: () => this.toast.show('Failed to load product for editing.', 'error')
    });
  }

  loadCatalogProducts() {
    this.catalogLoading.set(true);
    this.api.getVendorAvailableCatalogProducts({ page_size: 100 }).subscribe({
      next: (res) => {
        this.catalogProducts.set(res.results || res);
        this.catalogLoading.set(false);
      },
      error: () => {
        this.catalogLoading.set(false);
        this.toast.show('Failed to load approved catalog items.', 'error');
      }
    });
  }

  toggleCatalogSelection(catalogId: string, checked: boolean) {
    const selected = new Set(this.selectedCatalogIds());
    if (checked) selected.add(catalogId);
    else selected.delete(catalogId);
    this.selectedCatalogIds.set(Array.from(selected));
  }

  isCatalogSelected(catalogId: string): boolean {
    return this.selectedCatalogIds().includes(catalogId);
  }

  startStepper() {
    this.formError.set('');
    if (this.selectedCatalogIds().length === 0) {
      this.formError.set('Select at least one catalog product.');
      return;
    }
    this.creatingDrafts.set(true);
    this.api.createInheritedProductDraftBatch(this.selectedCatalogIds()).subscribe({
      next: (res) => {
        this.variantDrafts.set(res.variants || []);
        this.currentStep.set(1);
        this.creatingDrafts.set(false);
      },
      error: (err) => {
        this.creatingDrafts.set(false);
        this.toast.show(err?.error?.error || 'Could not create variant drafts.', 'error');
      }
    });
  }

  isStepAccessible(index: number): boolean {
    if (index === 0) return true;
    return index <= this.variantDrafts().length + 1;
  }

  goToStep(index: number) {
    if (!this.isStepAccessible(index)) return;
    this.currentStep.set(index);
    this.formError.set('');
  }

  nextStep() {
    const maxStep = this.dynamicSteps().length - 1;
    if (this.currentStep() < maxStep) this.currentStep.set(this.currentStep() + 1);
  }

  prevStep() {
    if (this.currentStep() > 0) this.currentStep.set(this.currentStep() - 1);
  }

  updateVariantField(variant: Product, field: string, value: any) {
    this.saving.set(true);
    this.api.updateInheritedProduct(variant.id, { [field]: value }).subscribe({
      next: (updated) => {
        this.variantDrafts.update(items => items.map(item => item.id === updated.id ? updated : item));
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.show(err?.error?.error || 'Failed to update variant.', 'error');
      }
    });
  }

  duplicateVariant(variant: Product) {
    this.api.duplicateInheritedProduct(variant.id).subscribe({
      next: (duplicate) => {
        this.variantDrafts.update(items => [...items, duplicate]);
        this.toast.show('Variant duplicated. Update values to avoid duplicates.', 'success');
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Duplicate failed.', 'error');
      }
    });
  }

  removeVariant(variant: Product) {
    const shouldDelete = typeof window === 'undefined'
      ? true
      : window.confirm(`Remove "${variant.catalog_product?.name || variant.name}" from this submission?`);
    if (!shouldDelete) return;

    const existingDrafts = this.variantDrafts();
    const currentStep = this.currentStep();
    const wasVariantStep = currentStep > 0 && currentStep <= existingDrafts.length;

    this.deletingVariantId.set(variant.id);
    this.api.deleteProduct(variant.id).subscribe({
      next: () => {
        const remaining = existingDrafts.filter(item => item.id !== variant.id);
        this.variantDrafts.set(remaining);

        const remainingCatalogIds = new Set(
          remaining
            .map(item => item.catalog_product?.id)
            .filter((id): id is string => !!id)
        );
        this.selectedCatalogIds.set(this.selectedCatalogIds().filter(id => remainingCatalogIds.has(id)));

        if (remaining.length === 0) {
          this.currentStep.set(0);
        } else if (wasVariantStep) {
          this.currentStep.set(Math.min(currentStep, remaining.length));
        } else {
          this.currentStep.set(remaining.length + 1);
        }

        this.deletingVariantId.set(null);
        this.toast.show('Variant removed from this submission.', 'success');
      },
      error: (err) => {
        this.deletingVariantId.set(null);
        this.toast.show(err?.error?.error || 'Failed to remove variant.', 'error');
      }
    });
  }

  submitVariants() {
    this.formError.set('');
    const ids = this.variantDrafts().map(item => item.id);
    if (!ids.length) {
      this.formError.set('No variants to submit.');
      return;
    }
    this.saving.set(true);
    this.api.submitInheritedProducts(ids).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Submitted for admin approval.', 'success');
      },
      error: (err) => {
        this.saving.set(false);
        const message = typeof err?.error?.error === 'string' ? err.error.error : 'Fix validation errors before submit.';
        this.formError.set(message);
        this.toast.show(message, 'error');
      }
    });
  }

  saveEditProduct() {
    this.formError.set('');
    if (!this.editProductId) return;
    const form = this.editForm();
    if (!form.price || form.price <= 0) {
      this.formError.set('Price must be greater than 0.');
      return;
    }
    if (form.stock < 0) {
      this.formError.set('Stock cannot be negative.');
      return;
    }
    if (form.min_order_quantity < 1) {
      this.formError.set('Minimum order quantity must be at least 1.');
      return;
    }
    this.submitting.set(true);
    this.api.patchProduct(this.editProductId, form).subscribe({
      next: (product) => {
        this.editProduct.set(product);
        localStorage.setItem(`vendor_product_name_${this.editProductId}`, product.name || 'Product');
        this.submitting.set(false);
        const msg = product.approval_status === 'pending_approval'
          ? 'Changes submitted for admin approval. Product is hidden until approved.'
          : 'Product updated successfully.';
        this.toast.show(msg, 'success');
      },
      error: (err) => {
        this.submitting.set(false);
        const message = err?.error?.error || 'Failed to update product.';
        this.formError.set(message);
        this.toast.show(message, 'error');
      }
    });
  }

  submitEditProductForApproval() {
    this.formError.set('');
    if (!this.editProductId || !this.canSubmitEditForApproval()) return;
    this.submitting.set(true);
    this.api.submitInheritedProducts([this.editProductId]).subscribe({
      next: (res) => {
        const submitted = (res?.variants || []).find((item: Product) => item.id === this.editProductId);
        const nextProduct = {
          ...(this.editProduct() || {}),
          ...(submitted || {}),
          approval_status: submitted?.approval_status || 'pending_approval',
          approval_status_label: submitted?.approval_status_label || 'Pending Approval',
          rejection_reason: submitted?.rejection_reason || '',
        } as Product;
        this.editProduct.set(nextProduct);
        this.submitting.set(false);
        this.toast.show('Product submitted for admin approval.', 'success');
      },
      error: (err) => {
        this.submitting.set(false);
        const raw = err?.error?.error;
        const message = typeof raw === 'string'
          ? raw
          : 'Fix product validation errors before submitting for approval.';
        this.formError.set(message);
        this.toast.show(message, 'error');
      }
    });
  }

  updateEditField(field: string, value: any) {
    this.editForm.update(form => ({ ...form, [field]: value }));
  }
}
