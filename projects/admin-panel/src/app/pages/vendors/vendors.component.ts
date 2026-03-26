import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DynamicTableComponent, TableCellDirective],
  templateUrl: './vendors.component.html',
  styleUrl: './vendors.component.scss'
})
export class VendorsComponent implements OnInit {
  private api = inject(ApiService);
  vendors = signal<any[]>([]);
  loading = signal(true);
  total = signal(0);
  search = '';
  statusFilter = '';
  actionId = signal<string | null>(null);

  page = signal(1);
  itemsPerPage = 20;
  Math = Math;

  tableColumns = [
    { key: 'vendor', label: 'Vendor', flex: '2.5fr' },
    { key: 'city', label: 'City', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'rating', label: 'Rating', flex: '1.2fr' },
    { key: 'min_order', label: 'Min Order', flex: '1fr' },
    { key: 'actions', label: 'Actions', flex: '1.5fr' }
  ];

  showModal = signal(false);
  isCreating = signal(false);
  editModel = signal<any>(null);
  saving = signal(false);
  modalError = signal('');

  defaultNew() {
    return {
      username: '', email: '', password: '', first_name: '', last_name: '',
      store_name: '', description: '', phone: '', address: '', city: '', state: '', postal_code: '',
      opening_time: '09:00', closing_time: '21:00',
      min_order_amount: 0, delivery_radius_km: 5,
      is_open: true, is_featured: false
    };
  }

  vendorColor(name: string): string {
    const colors = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#EF4444','#06B6D4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  private timer: any;

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.search) params.search = this.search;
    if (this.statusFilter) params.status = this.statusFilter;
    this.api.getAdminVendors(params).subscribe({
      next: (r) => { this.vendors.set(r.results || r); this.total.set(r.count || (r.results || r).length); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSearch() {
    this.page.set(1);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), 400);
  }

  changePage(p: number) {
    if (p >= 1 && p <= Math.ceil(this.total() / this.itemsPerPage)) {
      this.page.set(p);
      this.load();
    }
  }

  setStatus(v: any, newStatus: string) {
    this.actionId.set(v.id);
    this.api.setVendorStatus(v.id, newStatus).subscribe({
      next: () => { this.actionId.set(null); this.load(); },
      error: () => this.actionId.set(null)
    });
  }

  deleteVendor(v: any) {
    if (!confirm(`Delete vendor "${v.store_name}"? This is permanent.`)) return;
    this.api.deleteAdminVendor(v.id).subscribe({ next: () => this.load() });
  }

  openCreate() {
    this.isCreating.set(true);
    this.editModel.set(this.defaultNew());
    this.modalError.set('');
    this.showModal.set(true);
  }

  openEdit(v: any) {
    this.isCreating.set(false);
    this.editModel.set(JSON.parse(JSON.stringify(v)));
    this.modalError.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editModel.set(null);
  }

  saveVendor() {
    if (this.isCreating()) { this.saveCreate(); } else { this.saveVendorEdit(); }
  }

  private saveCreate() {
    if (!this.editModel() || this.saving()) return;
    this.saving.set(true);
    this.modalError.set('');
    this.api.createAdminVendor(this.editModel()).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: (err) => {
        this.saving.set(false);
        const detail = err.error ? JSON.stringify(err.error) : 'Failed to create vendor.';
        this.modalError.set(detail);
      }
    });
  }

  private saveVendorEdit() {
    if (!this.editModel() || this.saving()) return;
    this.saving.set(true);
    this.api.updateAdminVendor(this.editModel().id, this.editModel()).subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: () => this.saving.set(false)
    });
  }

  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
