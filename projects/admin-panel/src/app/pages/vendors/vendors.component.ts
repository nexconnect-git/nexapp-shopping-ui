import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DynamicTableComponent,
    TableCellDirective,
    AppCurrencyPipe,
  ],
  templateUrl: './vendors.component.html',
  styleUrl: './vendors.component.scss',
})
export class VendorsComponent implements OnInit, OnDestroy {
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
    { key: 'actions', label: 'Actions', flex: '1.5fr' },
  ];

  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;

  showModal = signal(false);
  isCreating = signal(false);
  editModel = signal<any>(null);
  saving = signal(false);
  modalError = signal('');

  defaultNew() {
    return {
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      store_name: '',
      description: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      opening_time: '09:00',
      closing_time: '21:00',
      min_order_amount: 0,
      delivery_radius_km: 5,
      is_open: true,
      is_featured: false,
    };
  }

  vendorColor(name: string): string {
    const colors = [
      '#38268E',
      '#38268E',
      '#EF4444',
      '#EF4444',
      '#22C55E',
      '#EF4444',
      '#38268E',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  private timer: any;

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.showModal()) this.load();
    });
  }

  ngOnDestroy() {
    this.reloadSub?.unsubscribe();
  }

  manualReload() {
    this.page.set(1);
    this.load();
  }
  toggleAutoReload() {
    this.autoReload.update((v) => !v);
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.search) params.search = this.search;
    if (this.statusFilter) params.status = this.statusFilter;
    this.api.getAdminVendors(params).subscribe({
      next: (r) => {
        this.vendors.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => this.loading.set(false),
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
      next: () => {
        this.actionId.set(null);
        this.load();
      },
      error: () => this.actionId.set(null),
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
    if (this.isCreating()) {
      this.saveCreate();
    } else {
      this.saveVendorEdit();
    }
  }

  private saveCreate() {
    if (!this.editModel() || this.saving()) return;
    this.saving.set(true);
    this.modalError.set('');
    const payload = {
      ...this.editModel(),
      username: this.editModel().username?.trim(),
      email: this.editModel().email?.trim(),
      first_name: this.editModel().first_name?.trim(),
      last_name: this.editModel().last_name?.trim(),
      store_name: this.editModel().store_name?.trim(),
      phone: this.editModel().phone?.trim(),
      address: this.editModel().address?.trim(),
      city: this.editModel().city?.trim(),
      state: this.editModel().state?.trim(),
      postal_code: this.editModel().postal_code?.trim(),
    };
    this.api.createAdminVendor(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.modalError.set(this.vendorCreateErrorMessage(err.error));
      },
    });
  }

  private saveVendorEdit() {
    if (!this.editModel() || this.saving()) return;
    this.saving.set(true);
    this.api
      .updateAdminVendor(this.editModel().id, this.editModel())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  starsFor(r: number) {
    const f = Math.round(r);
    return 'â˜…'.repeat(f) + 'â˜†'.repeat(5 - f);
  }

  private vendorCreateErrorMessage(error: any): string {
    const fieldErrors = ['username', 'email', 'phone', 'store_name']
      .map((field) =>
        error?.[field]?.[0] ? `${field}: ${error[field][0]}` : '',
      )
      .filter(Boolean);

    return (
      fieldErrors[0] ||
      error?.non_field_errors?.[0] ||
      error?.detail ||
      error?.error ||
      'Failed to create vendor.'
    );
  }
}

