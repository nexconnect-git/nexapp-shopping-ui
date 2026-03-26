import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Category } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, DynamicTableComponent, TableCellDirective],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  private api = inject(ApiService);
  products = signal<any[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal(false);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  search = '';
  error = signal('');
  private timer: any;

  tableColumns = [
    { key: 'product', label: 'Product', flex: '2fr' },
    { key: 'vendor', label: 'Vendor', flex: '1.5fr' },
    { key: 'category', label: 'Category', flex: '1.5fr' },
    { key: 'price', label: 'Price', flex: '1fr' },
    { key: 'stock', label: 'Stock', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'actions', label: 'Actions', flex: '1fr' }
  ];

  showModal = signal(false);
  editTarget = signal<any | null>(null);
  form: any = { name: '', description: '', price: '', compare_price: '', sku: '', stock: 0, unit: 'pcs', weight: '', is_available: true, is_featured: false, category: null, vendor_id: null };

  ngOnInit() { this.load(); this.loadCategories(); }

  loadCategories() {
    this.api.getAdminCategories().subscribe({ next: (r) => this.categories.set(r.results || r) });
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.search) params.search = this.search;
    this.api.getAdminProducts(params).subscribe({
      next: (r) => {
        this.products.set(r.results || r);
        this.total.set(r.count || 0);
        this.totalPages.set(Math.ceil((r.count || 0) / 20) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() { clearTimeout(this.timer); this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 400); }
  setPage(p: number) { this.page.set(p); this.load(); }

  openCreate() {
    this.editTarget.set(null);
    this.form = { name: '', description: '', price: '', compare_price: '', sku: '', stock: 0, unit: 'pcs', weight: '', is_available: true, is_featured: false, category: null, vendor_id: null };
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(p: any) {
    this.editTarget.set(p);
    this.form = {
      name: p.name, description: p.description || '', price: p.price, compare_price: p.compare_price || '',
      sku: p.sku || '', stock: p.stock, unit: p.unit || 'pcs', weight: p.weight || '',
      is_available: p.is_available, is_featured: p.is_featured,
      category: p.category?.id ?? null, vendor_id: p.vendor?.id ?? null
    };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.name.trim()) { this.error.set('Name is required.'); return; }
    if (!this.form.price) { this.error.set('Price is required.'); return; }
    this.saving.set(true);
    this.error.set('');
    const data: any = {
      name: this.form.name, description: this.form.description, price: this.form.price,
      stock: this.form.stock, unit: this.form.unit, is_available: this.form.is_available,
      is_featured: this.form.is_featured, category: this.form.category
    };
    if (this.form.compare_price) data.compare_price = this.form.compare_price;
    if (this.form.sku) data.sku = this.form.sku;
    if (this.form.weight) data.weight = this.form.weight;
    const target = this.editTarget();
    const req = target
      ? this.api.updateAdminProduct(target.id, data)
      : this.api.createAdminProduct({ ...data, vendor_id: this.form.vendor_id });
    req.subscribe({
      next: () => { this.saving.set(false); this.showModal.set(false); this.load(); },
      error: (err) => { this.saving.set(false); this.error.set(err.error?.detail || err.error?.name?.[0] || 'Save failed.'); }
    });
  }

  toggleAvailability(p: any) {
    this.api.updateAdminProduct(p.id, { is_available: !p.is_available }).subscribe({ next: () => this.load() });
  }

  delete(p: any) {
    if (!confirm(`Delete product "${p.name}"? This cannot be undone.`)) return;
    this.api.deleteAdminProduct(p.id).subscribe({ next: () => this.load() });
  }
}
