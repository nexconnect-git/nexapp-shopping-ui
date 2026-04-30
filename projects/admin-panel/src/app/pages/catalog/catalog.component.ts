import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, CatalogProduct, Category, DynamicTableColumn, DynamicTableComponent, TableCellDirective, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, DynamicTableComponent, TableCellDirective],
  template: `
    <div class="catalog-page">
      <section class="catalog-hero">
        <div class="hero-copy">
          <span class="eyebrow">Admin catalog</span>
          <h1 class="page-title">Master Catalog</h1>
          <p class="page-subtitle">Curate the approved product library vendors can use for faster listings.</p>
        </div>
        <div class="hero-actions">
          <button class="btn-secondary" (click)="load()" [disabled]="loading()" title="Refresh catalog">
            <span class="material-icons-outlined" [class.spin]="loading()">refresh</span>
          </button>
          <button class="btn-primary" (click)="openCreate()">
            <span class="material-icons-outlined">add</span>
            New Item
          </button>
        </div>
      </section>

      <section class="catalog-stats">
        <div class="stat-tile">
          <span>Total items</span>
          <strong>{{ total() }}</strong>
        </div>
        <div class="stat-tile">
          <span>Active</span>
          <strong>{{ activeCount() }}</strong>
        </div>
        <div class="stat-tile">
          <span>Inactive</span>
          <strong>{{ inactiveCount() }}</strong>
        </div>
        <div class="stat-tile">
          <span>Categories</span>
          <strong>{{ categories().length }}</strong>
        </div>
      </section>

      <section class="catalog-tools">
        <div class="search-wrap">
          <span class="material-icons-outlined search-icon">search</span>
          <input class="search-input" [(ngModel)]="search" (input)="onSearch()" placeholder="Search name, brand, barcode">
        </div>
        <select class="filter-select" [(ngModel)]="categoryFilter" (change)="load()">
          <option value="">All categories</option>
          @for (cat of categories(); track cat.id) {
            <option [value]="cat.id">{{ cat.name }}</option>
          }
        </select>
        <select class="filter-select" [(ngModel)]="statusFilter" (change)="load()">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </section>

      <app-dynamic-table
        [columns]="columns"
        [data]="items()"
        [loading]="loading()"
        [totalItems]="total()"
        [itemsPerPage]="pageSize"
        [page]="page()"
        emptyIcon="inventory_2"
        emptyMessage="No catalog items found"
        emptySubMessage="Try another filter or create a new catalog item."
        (pageChange)="setPage($event)"
      >
        <ng-template tableCell="item" let-item>
          <div class="item-cell">
            <div class="item-thumb">
              @if (primaryImage(item)) {
                <img [src]="primaryImage(item)" alt="{{ item.name }}">
              } @else {
                <span>{{ item.name?.[0] || '?' }}</span>
              }
            </div>
            <div class="item-copy">
              <strong>{{ item.name }}</strong>
              <small>{{ item.brand || 'No brand' }}{{ item.barcode ? ' / ' + item.barcode : '' }}</small>
            </div>
          </div>
        </ng-template>

        <ng-template tableCell="category" let-item>
          <span class="soft-pill">{{ item.category?.name || 'Uncategorized' }}</span>
        </ng-template>

        <ng-template tableCell="unit" let-item>
          <span class="unit-text">{{ item.unit || 'piece' }}</span>
        </ng-template>

        <ng-template tableCell="status" let-item>
          <span class="status-chip" [class.inactive]="!item.is_active">
            <span class="status-dot"></span>
            {{ item.is_active ? 'Active' : 'Inactive' }}
          </span>
        </ng-template>

        <ng-template tableCell="actions" let-item>
          <div class="actions">
            <button class="icon-action" (click)="openEdit(item)" title="Edit">
              <span class="material-icons-outlined">edit</span>
            </button>
            <button class="icon-action danger" (click)="delete(item)" title="Delete">
              <span class="material-icons-outlined">delete_outline</span>
            </button>
          </div>
        </ng-template>
      </app-dynamic-table>
    </div>

    @if (showModal()) {
      <div class="catalog-modal-backdrop" (click)="closeModal()">
        <div class="catalog-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <span class="eyebrow">{{ editTarget() ? 'Edit item' : 'Create item' }}</span>
              <h2>{{ editTarget() ? 'Update Catalog Item' : 'New Catalog Item' }}</h2>
            </div>
            <button class="modal-close" (click)="closeModal()" title="Close">
              <span class="material-icons-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group"><label class="form-label">Name *</label><input class="form-input" [(ngModel)]="form.name"></div>
              <div class="form-group"><label class="form-label">Brand</label><input class="form-input" [(ngModel)]="form.brand"></div>
            </div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" rows="3" [(ngModel)]="form.description"></textarea></div>
            <div class="form-row three">
              <div class="form-group">
                <label class="form-label">Category</label>
                <select class="form-input" [(ngModel)]="form.category_id">
                  <option [ngValue]="null">None</option>
                  @for (cat of categories(); track cat.id) { <option [ngValue]="cat.id">{{ cat.name }}</option> }
                </select>
              </div>
              <div class="form-group"><label class="form-label">Unit</label><input class="form-input" [(ngModel)]="form.unit"></div>
              <div class="form-group"><label class="form-label">Barcode</label><input class="form-input" [(ngModel)]="form.barcode"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label class="form-label">Search Keywords</label><input class="form-input" [(ngModel)]="form.search_keywords"></div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-input" [(ngModel)]="form.is_active">
                  <option [ngValue]="true">Active</option>
                  <option [ngValue]="false">Inactive</option>
                </select>
              </div>
            </div>
            @if (editTarget()) {
              <div class="form-group image-manager">
                <label class="form-label">Catalog Images</label>
                <div class="image-grid">
                  @for (image of modalImages(); track image.id) {
                    <div class="image-tile">
                      <img [src]="image.image" alt="Catalog image">
                      @if (image.is_primary) { <span class="image-badge">Primary</span> }
                      <button class="image-delete" (click)="deleteImage(image.id)" title="Delete image">
                        <span class="material-icons-outlined">delete_outline</span>
                      </button>
                    </div>
                  }
                  <label class="image-upload">
                    <input type="file" accept="image/*" (change)="onImageSelected($event)" hidden>
                    @if (imageUploading()) {
                      <span class="material-icons-outlined spin">refresh</span>
                      Uploading
                    } @else {
                      <span class="material-icons-outlined">add_photo_alternate</span>
                      Add Image
                    }
                  </label>
                </div>
                <p class="image-hint">Images upload through Django storage. With USE_S3=True they are saved to your S3/R2 bucket.</p>
              </div>
            } @else {
              <div class="image-notice">
                <span class="material-icons-outlined">image</span>
                Save the catalog item first, then upload images.
              </div>
            }
            <div class="form-group"><label class="form-label">Compliance Notes</label><textarea class="form-input" rows="2" [(ngModel)]="form.compliance_notes"></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary text" (click)="closeModal()">Cancel</button>
            <button class="btn-primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving...' : 'Save Item' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .catalog-page { display: flex; flex-direction: column; gap: 1rem; }
    .catalog-hero {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 1.25rem; border: 1px solid var(--border-color); border-radius: 8px;
      background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.04);
    }
    .hero-copy { min-width: 0; }
    .eyebrow { color: var(--primary); font-size: .72rem; font-weight: 950; text-transform: uppercase; }
    .page-title { margin: .15rem 0; color: var(--text-primary); font-size: 1.65rem; font-weight: 950; letter-spacing: 0; }
    .page-subtitle { margin: 0; color: var(--text-muted); font-size: .92rem; font-weight: 650; }
    .hero-actions, .catalog-tools, .actions { display: flex; align-items: center; gap: .65rem; flex-wrap: wrap; }
    .catalog-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
    .stat-tile {
      display: flex; flex-direction: column; gap: .35rem; padding: 1rem;
      border: 1px solid var(--border-color); border-radius: 8px; background: #fff;
    }
    .stat-tile span { color: var(--text-muted); font-size: .76rem; font-weight: 850; }
    .stat-tile strong { color: var(--text-primary); font-size: 1.45rem; font-weight: 950; line-height: 1; }
    .catalog-tools {
      padding: .8rem; border: 1px solid var(--border-color); border-radius: 8px; background: #fff;
    }
    .search-wrap {
      min-width: min(420px, 100%); flex: 1 1 320px; display: flex; align-items: center; gap: .65rem;
      border: 1px solid var(--border-color); border-radius: 8px; padding: 0 .75rem; background: #fff;
    }
    .search-icon { color: var(--text-muted); font-size: 20px; }
    .search-input { width: 100%; min-height: 42px; border: 0; outline: 0; background: transparent; color: var(--text-primary); font-weight: 700; }
    .filter-select, .form-input {
      min-height: 42px; border: 1px solid var(--border-color); border-radius: 8px; background: #fff;
      color: var(--text-primary); padding: .6rem .75rem; font: inherit; font-weight: 700; outline: none;
    }
    .btn-primary, .btn-secondary, .icon-action, .modal-close {
      display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer;
      font: inherit; font-weight: 850; transition: background .16s, border-color .16s, color .16s;
    }
    .btn-primary { gap: .45rem; min-height: 42px; padding: .65rem .95rem; border: 1px solid var(--primary); background: var(--primary); color: #fff; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); }
    .btn-secondary { width: 42px; height: 42px; border: 1px solid var(--border-color); background: #fff; color: var(--text-secondary); }
    .btn-secondary.text { width: auto; padding: .65rem .95rem; }
    .item-cell { display: flex; align-items: center; gap: .8rem; min-width: 0; }
    .item-thumb {
      width: 46px; height: 46px; flex: 0 0 46px; overflow: hidden; border: 1px solid var(--border-color);
      border-radius: 8px; background: #ecfeff; color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 950;
    }
    .item-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .item-copy { min-width: 0; display: flex; flex-direction: column; gap: .2rem; }
    .item-copy strong { color: var(--text-primary); font-size: .94rem; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .item-copy small { color: var(--text-muted); font-size: .76rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .soft-pill, .status-chip {
      display: inline-flex; align-items: center; width: fit-content; border-radius: 999px;
      padding: .32rem .62rem; font-size: .74rem; font-weight: 900; text-transform: uppercase;
    }
    .soft-pill { max-width: 100%; border: 1px solid var(--border-color); color: var(--text-secondary); background: var(--surface-color); }
    .unit-text { color: var(--text-secondary); font-weight: 850; }
    .status-chip { gap: .38rem; color: #15803d; background: #f0fdf4; }
    .status-chip.inactive { color: #b45309; background: #fffbeb; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .icon-action {
      width: 34px; height: 34px; border: 1px solid var(--border-color); background: #fff; color: var(--text-muted);
    }
    .icon-action:hover { color: var(--primary); background: var(--primary-light); border-color: transparent; }
    .icon-action.danger:hover { color: var(--danger); background: var(--danger-light); }
    .icon-action .material-icons-outlined { font-size: 18px; }
    .catalog-modal-backdrop {
      position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-start; justify-content: center;
      padding: 4rem 1rem 2rem; background: rgba(15,23,42,.52); overflow-y: auto;
    }
    .catalog-modal { width: min(760px, 100%); overflow: hidden; border: 1px solid var(--border-color); border-radius: 8px; background: #fff; box-shadow: 0 24px 80px rgba(15,23,42,.25); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-light); }
    .modal-header h2 { margin: .15rem 0 0; color: var(--text-primary); font-size: 1.1rem; font-weight: 950; }
    .modal-close { width: 38px; height: 38px; border: 1px solid var(--border-color); background: #fff; color: var(--text-secondary); }
    .modal-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .form-row.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .form-group { display: flex; flex-direction: column; gap: .4rem; }
    .form-label { color: var(--text-secondary); font-size: .78rem; font-weight: 850; }
    textarea.form-input { min-height: 90px; resize: vertical; }
    .modal-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 1rem 1.25rem; border-top: 1px solid var(--border-light); background: #f8fafc; }
    .image-manager { padding-top: .25rem; }
    .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: .75rem; }
    .image-tile, .image-upload {
      position: relative; min-height: 112px; border: 1px solid var(--border-color);
      border-radius: 8px; overflow: hidden; background: #f8fafc;
    }
    .image-tile img { width: 100%; height: 112px; object-fit: cover; display: block; }
    .image-badge {
      position: absolute; left: .45rem; bottom: .45rem; border-radius: 999px;
      padding: .25rem .5rem; background: rgba(6,182,212,.92); color: white;
      font-size: .68rem; font-weight: 900; text-transform: uppercase;
    }
    .image-delete {
      position: absolute; top: .35rem; right: .35rem; width: 30px; height: 30px;
      border: 0; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;
      background: rgba(15,23,42,.72); color: white; cursor: pointer;
    }
    .image-delete:hover { background: #dc2626; }
    .image-delete .material-icons-outlined { font-size: 17px; }
    .image-upload {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .45rem;
      border-style: dashed; color: var(--primary); font-weight: 900; cursor: pointer;
    }
    .image-upload:hover { background: var(--primary-light); border-color: var(--primary); }
    .image-upload .material-icons-outlined { font-size: 28px; }
    .image-hint, .image-notice { color: var(--text-muted); font-size: .78rem; font-weight: 700; margin: 0; }
    .image-notice {
      display: flex; align-items: center; gap: .55rem; padding: .8rem;
      border: 1px dashed var(--border-color); border-radius: 8px; background: #f8fafc;
    }
    @media (max-width: 860px) {
      .catalog-hero { align-items: stretch; flex-direction: column; }
      .catalog-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .form-row, .form-row.three { grid-template-columns: 1fr; }
    }
    @media (max-width: 540px) { .catalog-stats { grid-template-columns: 1fr; } }
  `]
})
export class CatalogComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  readonly columns: DynamicTableColumn[] = [
    { key: 'item', label: 'Item', flex: 'minmax(280px, 2fr)' },
    { key: 'category', label: 'Category', flex: 'minmax(160px, 1fr)' },
    { key: 'unit', label: 'Unit', flex: '110px' },
    { key: 'status', label: 'Status', flex: '130px' },
    { key: 'actions', label: 'Actions', flex: '110px', align: 'right' },
  ];

  items = signal<CatalogProduct[]>([]);
  modalImages = signal<any[]>([]);
  imageUploading = signal(false);
  categories = signal<Category[]>([]);
  loading = signal(false);
  saving = signal(false);
  showModal = signal(false);
  editTarget = signal<CatalogProduct | null>(null);
  total = signal(0);
  page = signal(1);
  readonly pageSize = 20;
  search = '';
  categoryFilter = '';
  statusFilter = 'all';
  form: any = this.emptyForm();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  activeCount = computed(() => this.items().filter(item => item.is_active).length);
  inactiveCount = computed(() => this.items().filter(item => !item.is_active).length);

  ngOnInit() {
    this.api.getAdminCategories({ page_size: 100 }).subscribe({ next: (r) => this.categories.set(r.results || r) });
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), page_size: this.pageSize };
    if (this.search) params.search = this.search;
    if (this.categoryFilter) params.category = this.categoryFilter;
    if (this.statusFilter !== 'all') params.is_active = this.statusFilter === 'active';
    this.api.getAdminCatalogProducts(params).subscribe({
      next: (r) => {
        const rows = r.results || r;
        this.items.set(rows);
        this.total.set(r.count || rows.length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  setPage(page: number) {
    this.page.set(page);
    this.load();
  }

  openCreate() {
    this.editTarget.set(null);
    this.form = this.emptyForm();
    this.modalImages.set([]);
    this.showModal.set(true);
  }

  openEdit(item: CatalogProduct) {
    this.editTarget.set(item);
    this.form = { ...item, category_id: item.category?.id || null };
    this.modalImages.set(item.images || []);
    this.showModal.set(true);
    this.loadImages(item.id);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.name?.trim()) {
      this.toast.show('Name is required.', 'error');
      return;
    }
    this.saving.set(true);
    const target = this.editTarget();
    const req = target
      ? this.api.updateAdminCatalogProduct(target.id, this.form)
      : this.api.createAdminCatalogProduct(this.form);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toast.show('Failed to save catalog item.', 'error');
      },
    });
  }

  loadImages(productId: string) {
    this.api.getAdminCatalogProductImages(productId).subscribe({
      next: (images) => this.modalImages.set(images),
    });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const target = this.editTarget();
    if (!file || !target) return;
    this.imageUploading.set(true);
    this.api.uploadAdminCatalogProductImage(target.id, file, this.modalImages().length === 0).subscribe({
      next: () => {
        this.imageUploading.set(false);
        input.value = '';
        this.loadImages(target.id);
        this.load();
      },
      error: () => {
        this.imageUploading.set(false);
        this.toast.show('Failed to upload catalog image.', 'error');
      },
    });
  }

  deleteImage(imageId: string) {
    const target = this.editTarget();
    if (!target || !confirm('Delete this catalog image?')) return;
    this.api.deleteAdminCatalogProductImage(target.id, imageId).subscribe({
      next: () => {
        this.loadImages(target.id);
        this.load();
      },
      error: () => this.toast.show('Failed to delete catalog image.', 'error'),
    });
  }

  delete(item: CatalogProduct) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    this.api.deleteAdminCatalogProduct(item.id).subscribe({ next: () => this.load() });
  }

  primaryImage(item: CatalogProduct): string | null {
    return item.images?.find(image => image.is_primary)?.image || item.images?.[0]?.image || null;
  }

  private emptyForm() {
    return { name: '', description: '', brand: '', unit: 'piece', barcode: '', search_keywords: '', compliance_notes: '', category_id: null, is_active: true };
  }
}
