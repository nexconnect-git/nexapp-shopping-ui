import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';

@Component({
  selector: 'app-delivery-partners',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DynamicTableComponent,
    TableCellDirective,
  ],
  templateUrl: './delivery-partners.component.html',
  styleUrl: './delivery-partners.component.scss',
})
export class DeliveryPartnersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  partners = signal<any[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  search = '';
  approvedFilter = '';
  statusFilter = '';
  actionId = signal<string | null>(null);

  tableColumns = [
    { key: 'partner', label: 'Partner', flex: '1.5fr' },
    { key: 'vehicle', label: 'Vehicle', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'deliveries', label: 'Deliveries', flex: '1fr' },
    { key: 'rating', label: 'Rating', flex: '1fr' },
    { key: 'approved', label: 'Approved', flex: '1fr' },
    { key: 'actions', label: 'Actions', flex: '1.2fr' },
  ];

  showModal = signal(false);
  editModel = signal<any>(null);
  saving = signal(false);

  showCreateModal = signal(false);
  createError = signal('');
  creating = signal(false);
  createForm = {
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    vehicle_type: '',
    vehicle_number: '',
    license_number: '',
  };

  private timer: any;
  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.showModal() && !this.showCreateModal())
        this.load();
    });
  }

  ngOnDestroy() {
    this.reloadSub?.unsubscribe();
  }

  goToProfile(p: any) {
    this.router.navigate(['/delivery-partners', p.id]);
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
    if (this.approvedFilter) params.is_approved = this.approvedFilter;
    if (this.statusFilter) params.status = this.statusFilter;
    this.api.getAdminDeliveryPartners(params).subscribe({
      next: (r) => {
        this.partners.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(Math.ceil((r.count || 0) / 20) || 1);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 400);
  }
  setPage(p: number) {
    this.page.set(p);
    this.load();
  }

  approve(p: any) {
    this.actionId.set(p.id);
    this.api.approveDeliveryPartner(p.id, 'approve').subscribe({
      next: () => {
        this.actionId.set(null);
        this.load();
      },
      error: () => this.actionId.set(null),
    });
  }

  reject(p: any) {
    if (!confirm(`Revoke approval for ${p.user?.username}?`)) return;
    this.actionId.set(p.id);
    this.api.approveDeliveryPartner(p.id, 'reject').subscribe({
      next: () => {
        this.actionId.set(null);
        this.load();
      },
      error: () => this.actionId.set(null),
    });
  }

  deletePartner(p: any) {
    if (
      !confirm(
        `Delete delivery partner "${p.user?.username}"? This is permanent.`,
      )
    )
      return;
    this.api
      .deleteAdminDeliveryPartner(p.id)
      .subscribe({ next: () => this.load() });
  }

  openEdit(p: any) {
    this.editModel.set(JSON.parse(JSON.stringify(p)));
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editModel.set(null);
  }

  savePartner() {
    if (!this.editModel() || this.saving()) return;
    this.saving.set(true);
    this.api
      .updateAdminDeliveryPartner(this.editModel().id, this.editModel())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  openCreateModal() {
    this.createForm = {
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      vehicle_type: '',
      vehicle_number: '',
      license_number: '',
    };
    this.createError.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  onCreatePartner() {
    if (
      !this.createForm.username ||
      !this.createForm.email ||
      !this.createForm.password ||
      !this.createForm.vehicle_type ||
      !this.createForm.license_number
    ) {
      this.createError.set('Please fill in all required fields.');
      return;
    }
    this.creating.set(true);
    this.createError.set('');
    const payload = {
      ...this.createForm,
      username: this.createForm.username.trim(),
      email: this.createForm.email.trim(),
      first_name: this.createForm.first_name.trim(),
      last_name: this.createForm.last_name.trim(),
      phone: this.createForm.phone.trim(),
      vehicle_number: this.createForm.vehicle_number.trim(),
      license_number: this.createForm.license_number.trim(),
    };
    this.api.createAdminDeliveryPartner(payload).subscribe({
      next: () => {
        this.creating.set(false);
        this.closeCreateModal();
        this.load();
      },
      error: (err) => {
        this.createError.set(this.createPartnerErrorMessage(err.error));
        this.creating.set(false);
      },
    });
  }

  starsFor(r: number) {
    const f = Math.round(r);
    return '★'.repeat(f) + '☆'.repeat(5 - f);
  }

  private createPartnerErrorMessage(error: any): string {
    return (
      error?.username?.[0] ||
      error?.email?.[0] ||
      error?.phone?.[0] ||
      error?.license_number?.[0] ||
      error?.vehicle_type?.[0] ||
      error?.non_field_errors?.[0] ||
      error?.detail ||
      error?.error ||
      'Failed to create partner.'
    );
  }
}
