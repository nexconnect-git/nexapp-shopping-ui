import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  AppCurrencyPipe,
  formatFormErrors,
} from '@shared/public-api';

interface ProductRow {
  id: string;
  name: string;
  category: any;
  price: number;
  stock: number;
  status: string;
  is_available: boolean;
  vendor: any;
  vendor_name: string;
}

interface VendorGroup {
  vendorId: string;
  vendorName: string;
  city: string;
  products: ProductRow[];
  collapsed: boolean;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent implements OnInit {
  private api = inject(ApiService);

  allProducts = signal<ProductRow[]>([]);
  loading = signal(true);
  search = '';
  statusFilter = 'all';
  private searchTimer: any;

  vendorGroups = signal<VendorGroup[]>([]);

  page = signal(1);
  total = signal(0);
  totalPages = signal(1);
  readonly PAGE_SIZE = 100; // load more at once to group properly

  // Modal for edit
  showModal = signal(false);
  saving = signal(false);
  editTarget = signal<any | null>(null);
  error = signal('');
  categories = signal<any[]>([]);
  form: any = {
    name: '',
    description: '',
    price: '',
    compare_price: '',
    sku: '',
    stock: 0,
    unit: 'pcs',
    weight: '',
    is_available: true,
    status: 'active',
    is_featured: false,
    category: null,
  };

  ngOnInit() {
    this.api
      .getAdminCategories()
      .subscribe({ next: (r) => this.categories.set(r.results || r) });
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: 1, page_size: this.PAGE_SIZE };
    if (this.search) params.search = this.search;
    if (this.statusFilter !== 'all') params.status = this.statusFilter;

    this.api.getAdminProducts(params).subscribe({
      next: (r) => {
        const products: ProductRow[] = r.results || r;
        this.allProducts.set(products);
        this.total.set(r.count || products.length);
        this.buildGroups(products);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  buildGroups(products: ProductRow[]) {
    const map = new Map<string, VendorGroup>();
    for (const p of products) {
      const vid = p.vendor?.id ?? 'unknown';
      const vname = p.vendor_name || p.vendor?.store_name || 'Unknown Vendor';
      const city = p.vendor?.city || '';
      if (!map.has(vid)) {
        map.set(vid, {
          vendorId: vid,
          vendorName: vname,
          city,
          products: [],
          collapsed: false,
        });
      }
      map.get(vid)!.products.push(p);
    }
    this.vendorGroups.set(Array.from(map.values()));
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 400);
  }

  onFilterChange() {
    this.load();
  }

  toggleGroup(group: VendorGroup) {
    group.collapsed = !group.collapsed;
  }

  openEdit(p: any) {
    this.editTarget.set(p);
    this.form = {
      name: p.name,
      description: p.description || '',
      price: p.price,
      compare_price: p.compare_price || '',
      sku: p.sku || '',
      stock: p.stock,
      unit: p.unit || 'pcs',
      weight: p.weight || '',
      is_available: p.is_available,
      status: p.status || 'active',
      is_featured: p.is_featured,
      category: p.category?.id ?? null,
    };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  isProductFormValid(): boolean {
    return (
      !!this.form.name?.trim() &&
      !!this.form.description?.trim() &&
      Number(this.form.price) > 0
    );
  }

  save() {
    if (!this.form.name?.trim()) {
      this.error.set('Name is required.');
      return;
    }
    if (!this.form.description?.trim()) {
      this.error.set('Description is required.');
      return;
    }
    if (!this.form.price) {
      this.error.set('Price is required.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const data: any = {
      name: this.form.name,
      description: this.form.description,
      price: this.form.price,
      stock: this.form.stock,
      unit: this.form.unit,
      is_available: this.form.is_available,
      status: this.form.status,
      is_featured: this.form.is_featured,
      category: this.form.category,
    };
    if (this.form.compare_price) data.compare_price = this.form.compare_price;
    if (this.form.sku) data.sku = this.form.sku;
    if (this.form.weight) data.weight = this.form.weight;
    const target = this.editTarget();
    this.api.updateAdminProduct(target.id, data).subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(formatFormErrors(err.error, 'Save failed.'));
      },
    });
  }

  delete(p: any) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    this.api.deleteAdminProduct(p.id).subscribe({ next: () => this.load() });
  }

  statusLabel(s: string): string {
    return (
      {
        active: 'Active',
        draft: 'Draft',
        sold_out: 'Sold Out',
        coming_soon: 'Coming Soon',
        archived: 'Archived',
      }[s] || s
    );
  }

  statusClass(s: string): string {
    return (
      {
        active: 'chip-active',
        draft: 'chip-draft',
        sold_out: 'chip-sold-out',
        coming_soon: 'chip-coming-soon',
        archived: 'chip-archived',
      }[s] || ''
    );
  }

  stockClass(p: ProductRow): string {
    if (p.stock === 0) return 'stock-empty';
    if (p.stock < 10) return 'stock-low';
    return 'stock-ok';
  }
}
