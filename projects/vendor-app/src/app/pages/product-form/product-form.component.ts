import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe, Category, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppCurrencyPipe],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss'
})
export class ProductFormComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = signal(false);
  productId: string | null = null;
  rootCategories = signal<Category[]>([]);
  saving = signal(false);
  images = signal<any[]>([]);

  // Category selection state
  selectedRootId = signal<string | null>(null);
  selectedSubId = signal<string | null>(null);

  // Derived subcategories for the selected root
  subcategories = computed(() => {
    const root = this.rootCategories().find(c => c.id === this.selectedRootId());
    return root?.children ?? [];
  });

  // The actual category ID sent in the payload: subcategory if chosen, otherwise root
  selectedCategoryId = computed<string | null>(() => this.selectedSubId() ?? this.selectedRootId());

  selectedRootName = computed(() => this.rootCategories().find(c => c.id === this.selectedRootId())?.name ?? '');

  // Inline category creation modal state
  showCatModal = signal(false);
  catModalMode = signal<'root' | 'sub'>('root');
  catModalName = signal('');
  catModalDesc = signal('');
  catModalSaving = signal(false);
  catModalError = signal('');

  form: any = {
    name: '', description: '', price: null, compare_price: null,
    stock: 0, low_stock_threshold: 10, unit: 'pcs', sku: '', weight: '',
    category: null, is_available: true, status: 'active', is_featured: false,
  };

  ngOnInit() {
    this.loadCategories();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.productId = id;
      this.api.getProduct(this.productId).subscribe({
        next: (p) => {
          this.form = {
            name: p.name, description: p.description || '', price: p.price,
            compare_price: p.compare_price, stock: p.stock, unit: p.unit || 'pcs',
            sku: p.sku || '', weight: p.weight || '',
            category: p.category?.id || null,
            is_available: p.is_available, status: p.status || 'active',
            is_featured: p.is_featured, low_stock_threshold: p.low_stock_threshold ?? 10,
          };
          // Pre-select the right root/sub dropdowns from the loaded product
          this.loadImages();
          // After categories load, resolve which root/sub is pre-selected
          this.resolveInitialCategory(p.category);
        }
      });
    }
  }

  loadCategories(afterLoad?: () => void) {
    this.api.getVendorCategories().subscribe({
      next: (res: Category[]) => {
        this.rootCategories.set(res);
        afterLoad?.();
      }
    });
  }

  /** After an edit load, expand the correct root/subcategory dropdowns. */
  private resolveInitialCategory(cat: Category | null) {
    if (!cat) return;
    const roots = this.rootCategories();
    // Is the product's category a root or a sub?
    const asRoot = roots.find(r => r.id === cat.id);
    if (asRoot) {
      this.selectedRootId.set(cat.id);
      return;
    }
    // It's a subcategory — find its parent
    for (const root of roots) {
      if (root.children?.some(ch => ch.id === cat.id)) {
        this.selectedRootId.set(root.id);
        this.selectedSubId.set(cat.id);
        return;
      }
    }
    // If categories weren't loaded yet, retry once they are
    if (roots.length === 0) {
      this.loadCategories(() => this.resolveInitialCategory(cat));
    }
  }

  onRootChange(rootId: string | null) {
    this.selectedRootId.set(rootId);
    this.selectedSubId.set(null);
  }

  onSubChange(subId: string | null) {
    this.selectedSubId.set(subId);
  }

  // ── Category creation modal ────────────────────────────────────────────────

  openCreateRoot() {
    this.catModalMode.set('root');
    this.catModalName.set('');
    this.catModalDesc.set('');
    this.catModalError.set('');
    this.showCatModal.set(true);
  }

  openCreateSub() {
    this.catModalMode.set('sub');
    this.catModalName.set('');
    this.catModalDesc.set('');
    this.catModalError.set('');
    this.showCatModal.set(true);
  }

  closeCatModal() { this.showCatModal.set(false); }

  saveCatModal() {
    const name = this.catModalName().trim();
    if (!name) { this.catModalError.set('Name is required.'); return; }
    this.catModalSaving.set(true);
    this.catModalError.set('');

    const payload = { name, description: this.catModalDesc() };
    const mode = this.catModalMode();
    const parentId = this.selectedRootId();

    const req = (mode === 'sub' && parentId)
      ? this.api.createVendorSubcategory(parentId, payload)
      : this.api.createVendorCategory(payload);

    req.subscribe({
      next: (created: Category) => {
        this.catModalSaving.set(false);
        this.showCatModal.set(false);
        this.toast.show(`Category "${created.name}" created! Admin will review it for customer app visibility.`, 'success');
        // Reload categories then auto-select the new one
        this.loadCategories(() => {
          if (mode === 'root') {
            this.selectedRootId.set(created.id);
            this.selectedSubId.set(null);
          } else {
            this.selectedSubId.set(created.id);
          }
        });
      },
      error: (err: any) => {
        const e = err.error || {};
        this.catModalError.set(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Failed to create category.');
        this.catModalSaving.set(false);
      }
    });
  }

  // ── Product save ───────────────────────────────────────────────────────────

  save() {
    this.saving.set(true);
    const payload = { ...this.form, category: this.selectedCategoryId() };
    if (!payload.compare_price) delete payload.compare_price;
    if (!payload.category) delete payload.category;

    const req = this.isEdit()
      ? this.api.updateProduct(this.productId!, payload)
      : this.api.createProduct(payload);

    req.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.show(this.isEdit() ? 'Product updated!' : 'Product created! You can now upload images.', 'success');
        if (!this.isEdit()) {
          this.productId = res.id;
          this.isEdit.set(true);
        } else {
          setTimeout(() => this.router.navigate(['/products']), 1200);
        }
      },
      error: (err) => {
        const e = err.error || {};
        this.toast.show(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Save failed.', 'error');
        this.saving.set(false);
      }
    });
  }

  // ── Images ─────────────────────────────────────────────────────────────────

  loadImages() {
    if (!this.productId) return;
    this.api.getProductImages(this.productId).subscribe({ next: (imgs) => this.images.set(imgs) });
  }

  onFileSelected(event: any) {
    if (!this.productId) { this.toast.show('Please save the product first before uploading images.', 'error'); return; }
    if (this.images().length >= 5) { this.toast.show('Maximum 5 photos allowed per product.', 'error'); return; }
    const file = event.target.files[0];
    if (file) {
      this.api.uploadProductImage(this.productId, file).subscribe({
        next: () => { this.loadImages(); this.toast.show('Image uploaded successfully.', 'success'); },
        error: (err) => this.toast.show(err.error?.error || 'Upload failed.', 'error')
      });
    }
  }

  deleteImage(imgId: string) {
    if (!this.productId || !confirm('Delete this image?')) return;
    this.api.deleteProductImage(this.productId, imgId).subscribe({
      next: () => this.loadImages(),
      error: () => this.toast.show('Failed to delete image.', 'error')
    });
  }
}
