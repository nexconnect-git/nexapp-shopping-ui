import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  CatalogProduct,
  Category,
  DynamicTableColumn,
  DynamicTableComponent,
  TableCellDirective,
  ToastService,
} from '@shared/public-api';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DynamicTableComponent,
    TableCellDirective,
  ],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
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

  activeCount = computed(
    () => this.items().filter((item) => item.is_active).length,
  );
  inactiveCount = computed(
    () => this.items().filter((item) => !item.is_active).length,
  );

  ngOnInit() {
    this.api
      .getAdminCategories({ page_size: 100 })
      .subscribe({ next: (r) => this.categories.set(r.results || r) });
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), page_size: this.pageSize };
    if (this.search) params.search = this.search;
    if (this.categoryFilter) params.category = this.categoryFilter;
    if (this.statusFilter !== 'all')
      params.is_active = this.statusFilter === 'active';
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

  closeModal() {
    this.showModal.set(false);
  }

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
    this.api
      .uploadAdminCatalogProductImage(
        target.id,
        file,
        this.modalImages().length === 0,
      )
      .subscribe({
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
    this.api
      .deleteAdminCatalogProduct(item.id)
      .subscribe({ next: () => this.load() });
  }

  primaryImage(item: CatalogProduct): string | null {
    return (
      item.images?.find((image) => image.is_primary)?.image ||
      item.images?.[0]?.image ||
      null
    );
  }

  private emptyForm() {
    return {
      name: '',
      description: '',
      brand: '',
      unit: 'piece',
      barcode: '',
      search_keywords: '',
      compliance_notes: '',
      category_id: null,
      is_active: true,
    };
  }
}
