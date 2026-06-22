import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ApiService,
  apiErrorMessage,
  isValidEmail,
  isValidIndianPhone,
  normalizeIndianPhone,
  parseFormErrors,
  sanitizeEmail,
} from '@shared/public-api';
import {
  DynamicTableColumn,
  DynamicTableComponent,
  TableCellDirective,
} from '@shared/public-api';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DynamicTableComponent,
    TableCellDirective,
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
})
export class CustomersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  customers = signal<any[]>([]);
  loading = signal(true);
  saving = signal(false);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  search = '';
  verifiedFilter = '';
  error = signal('');
  fieldErrors = signal<Record<string, string>>({});
  private timer: any;

  tableColumns: DynamicTableColumn[] = [
    { key: 'name', label: 'Customer', flex: '1.45fr' },
    { key: 'username', label: 'Username', flex: '1.1fr' },
    { key: 'email', label: 'Email', flex: '1.45fr' },
    { key: 'phone', label: 'Phone', flex: '0.9fr' },
    { key: 'verified', label: 'Status', flex: '0.75fr' },
    { key: 'actions', label: '', flex: '0.55fr', align: 'right' },
  ];

  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;

  showModal = signal(false);
  editTarget = signal<any | null>(null);
  form = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    is_verified: false,
    is_active: true,
  };

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.showModal()) this.load();
    });
  }

  ngOnDestroy() {
    this.reloadSub?.unsubscribe();
  }

  goToProfile(c: any) {
    this.router.navigate(['/customers', c.id]);
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
    if (this.verifiedFilter) params.is_verified = this.verifiedFilter;
    this.api.getAdminCustomers(params).subscribe({
      next: (r) => {
        this.customers.set(r.results || r);
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

  openEdit(c: any) {
    this.editTarget.set(c);
    this.form = {
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      is_verified: c.is_verified,
      is_active: c.is_active !== false,
    };
    this.error.set('');
    this.fieldErrors.set({});
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  save() {
    if (!this.editTarget()) return;
    this.form.email = sanitizeEmail(this.form.email);
    this.form.phone = normalizeIndianPhone(this.form.phone);
    const errors = this.validateForm();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      this.error.set('Please fix the highlighted customer fields.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api.updateAdminCustomer(this.editTarget().id, this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        const parsed = parseFormErrors(err?.error || err);
        this.fieldErrors.set(parsed.fieldErrors);
        this.error.set(apiErrorMessage(err, 'Update failed.'));
      },
    });
  }

  onEmailInput(value: string) {
    this.form.email = sanitizeEmail(value);
    this.clearFieldError('email');
  }

  onPhoneInput(value: string) {
    this.form.phone = normalizeIndianPhone(value);
    this.clearFieldError('phone');
  }

  fieldError(field: string): string {
    return this.fieldErrors()[field] || '';
  }

  clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    this.error.set('');
  }

  canSave(): boolean {
    return !this.saving() && Object.keys(this.validateForm()).length === 0;
  }

  private validateForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (this.form.email && !isValidEmail(this.form.email))
      errors['email'] = 'Enter a valid email address, e.g. user@example.com.';
    if (this.form.phone && !isValidIndianPhone(this.form.phone))
      errors['phone'] = 'Enter a valid 10-digit Indian mobile number.';
    return errors;
  }

  deleteCustomer(c: any) {
    if (!confirm(`Delete customer "${c.username}"? This is permanent.`)) return;
    this.api.deleteAdminCustomer(c.id).subscribe({ next: () => this.load() });
  }
}
