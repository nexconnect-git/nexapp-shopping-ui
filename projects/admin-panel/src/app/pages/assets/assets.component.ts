import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, FormsModule, DynamicTableComponent, TableCellDirective],
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss'
})
export class AssetsComponent implements OnInit {
  private api = inject(ApiService);

  assets = signal<any[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  itemsPerPage = 20;

  typeFilter = '';
  statusFilter = '';

  actionId = signal<string | null>(null);
  showModal = signal(false);
  isCreating = signal(true);
  editModel = signal<any>(null);
  saving = signal(false);
  modalError = signal('');

  deliveryPartners = signal<any[]>([]);

  tableColumns = [
    { key: 'name', label: 'Asset', flex: '2fr' },
    { key: 'type', label: 'Type', flex: '1fr' },
    { key: 'serial', label: 'Serial No', flex: '1fr' },
    { key: 'assigned', label: 'Assigned To', flex: '1.5fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'actions', label: 'Actions', flex: '1fr' },
  ];

  assetTypes = [
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'tracking_device', label: 'Tracking Device' },
    { value: 'uniform', label: 'Uniform' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'other', label: 'Other' },
  ];

  assetStatuses = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'maintenance', label: 'Under Maintenance' },
    { value: 'retired', label: 'Retired' },
  ];

  ngOnInit() {
    this.load();
    this.loadPartners();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.typeFilter) params.type = this.typeFilter;
    if (this.statusFilter) params.status = this.statusFilter;
    this.api.getAssets(params).subscribe({
      next: (r) => {
        this.assets.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadPartners() {
    this.api.getAdminDeliveryPartners().subscribe({
      next: (r) => this.deliveryPartners.set(r.results || r),
      error: () => {}
    });
  }

  changePage(p: number) {
    this.page.set(p);
    this.load();
  }

  openCreate() {
    this.isCreating.set(true);
    this.editModel.set({
      name: '', asset_type: 'vehicle', serial_number: '', description: '',
      status: 'active', assigned_to: null, purchase_date: null
    });
    this.modalError.set('');
    this.showModal.set(true);
  }

  openEdit(a: any) {
    this.isCreating.set(false);
    this.editModel.set({ ...a });
    this.modalError.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editModel.set(null);
  }

  saveAsset() {
    if (this.saving()) return;
    const m = this.editModel();
    if (!m.name) { this.modalError.set('Asset name is required.'); return; }
    this.saving.set(true);
    this.modalError.set('');

    const payload = { ...m };
    if (!payload.assigned_to) payload.assigned_to = null;
    if (!payload.purchase_date) payload.purchase_date = null;

    const req$ = this.isCreating()
      ? this.api.createAsset(payload)
      : this.api.updateAsset(m.id, payload);

    req$.subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.load(); },
      error: (err: any) => {
        this.saving.set(false);
        this.modalError.set(err.error ? JSON.stringify(err.error) : 'Failed to save asset.');
      }
    });
  }

  deleteAsset(a: any) {
    if (!confirm(`Delete asset "${a.name}"? This is permanent.`)) return;
    this.api.deleteAsset(a.id).subscribe({ next: () => this.load() });
  }

  statusClass(s: string): string {
    const map: Record<string, string> = {
      active: 'badge-active', inactive: 'badge-inactive',
      maintenance: 'badge-maintenance', retired: 'badge-retired'
    };
    return map[s] || '';
  }

  typeLabel(t: string): string {
    return this.assetTypes.find(x => x.value === t)?.label || t;
  }

  statusLabel(s: string): string {
    return this.assetStatuses.find(x => x.value === s)?.label || s;
  }
}
