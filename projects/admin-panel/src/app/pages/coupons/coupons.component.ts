import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  AppCurrencyPipe,
  formatFormErrors,
  parseFormErrors,
} from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';

interface CouponForm {
  code: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed' | 'free_delivery';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  per_user_limit: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  vendor: string | null;
  display_section: 'hero' | 'more';
  badge_text: string;
  icon_name: string;
  accent_color: string;
  display_order: number;
}

@Component({
  selector: 'app-coupons',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DynamicTableComponent,
    TableCellDirective,
    AppCurrencyPipe,
  ],
  templateUrl: './coupons.component.html',
  styleUrl: './coupons.component.scss',
})
export class CouponsComponent implements OnInit {
  private api = inject(ApiService);

  coupons = signal<any[]>([]);
  loading = signal(true);
  saving = signal(false);
  deleting = signal<string | null>(null);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  error = signal('');
  success = signal('');
  fieldErrors = signal<Record<string, string>>({});

  totalItems = 0;
  page = 1;

  tableColumns = [
    { key: 'code', label: 'Code', flex: '1fr' },
    { key: 'details', label: 'Details', flex: '1.5fr' },
    { key: 'discount', label: 'Discount', flex: '1fr' },
    { key: 'placement', label: 'Placement', flex: '1fr' },
    { key: 'scope', label: 'Scope', flex: '1fr' },
    { key: 'limits', label: 'Used / Limit', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1.5fr' },
    { key: 'actions', label: 'Actions', flex: '0.5fr' },
  ];

  form: CouponForm = this.blankForm();

  readonly discountTypes = [
    { value: 'percentage', label: 'Percentage (%)' },
    { value: 'fixed', label: 'Fixed Amount (Rs.)' },
    { value: 'free_delivery', label: 'Free Delivery' },
  ];

  readonly displaySections = [
    { value: 'hero', label: 'Featured hero' },
    { value: 'more', label: 'More offers' },
  ];

  readonly iconOptions = [
    { value: 'local-offer', label: 'Offer tag' },
    { value: 'delivery-dining', label: 'Delivery' },
    { value: 'percent', label: 'Percent' },
    { value: 'shopping-bag', label: 'Shopping bag' },
    { value: 'bolt', label: 'Fast deal' },
    { value: 'redeem', label: 'Reward' },
  ];

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getAdminCoupons({ page: this.page }).subscribe({
      next: (res) => {
        this.coupons.set(res.results || res);
        this.totalItems = res.count || this.coupons().length;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPageChange(page: number) {
    this.page = page;
    this.load();
  }

  blankForm(): CouponForm {
    const now = new Date();
    const later = new Date(
      now.getFullYear() + 1,
      now.getMonth(),
      now.getDate()
    );
    return {
      code: '',
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      min_order_amount: 0,
      max_discount_amount: null,
      usage_limit: null,
      per_user_limit: 1,
      valid_from: now.toISOString().slice(0, 16),
      valid_until: later.toISOString().slice(0, 16),
      is_active: true,
      vendor: null,
      display_section: 'more',
      badge_text: '',
      icon_name: 'local-offer',
      accent_color: '#ff4b1f',
      display_order: 0,
    };
  }

  openCreate() {
    this.form = this.blankForm();
    this.editingId.set(null);
    this.error.set('');
    this.fieldErrors.set({});
    this.showForm.set(true);
  }

  openEdit(c: any) {
    this.form = {
      code: c.code,
      title: c.title,
      description: c.description || '',
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_order_amount: c.min_order_amount,
      max_discount_amount: c.max_discount_amount,
      usage_limit: c.usage_limit,
      per_user_limit: c.per_user_limit,
      valid_from: c.valid_from?.slice(0, 16) || '',
      valid_until: c.valid_until?.slice(0, 16) || '',
      is_active: c.is_active,
      vendor: c.vendor || null,
      display_section: c.display_section || 'more',
      badge_text: c.badge_text || '',
      icon_name: c.icon_name || 'local-offer',
      accent_color: c.accent_color || '#ff4b1f',
      display_order: c.display_order || 0,
    };
    this.editingId.set(c.id);
    this.error.set('');
    this.fieldErrors.set({});
    this.showForm.set(true);
  }

  save() {
    this.error.set('');
    const validationErrors = this.validateCouponForm();
    this.fieldErrors.set(validationErrors);
    if (Object.keys(validationErrors).length) {
      this.error.set('Please fix the highlighted coupon fields.');
      return;
    }

    this.saving.set(true);
    const payload = {
      ...this.form,
      code: this.form.code.trim().toUpperCase(),
      valid_from: new Date(this.form.valid_from).toISOString(),
      valid_until: this.form.valid_until
        ? new Date(this.form.valid_until).toISOString()
        : null,
    };
    const req = this.editingId()
      ? this.api.updateAdminCoupon(this.editingId()!, payload)
      : this.api.createAdminCoupon(payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.success.set(
          this.editingId() ? 'Coupon updated.' : 'Coupon created.'
        );
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        const parsed = parseFormErrors(err.error);
        this.fieldErrors.set(parsed.fieldErrors);
        this.error.set(
          formatFormErrors(err.error, 'Failed to save coupon.', {
            code: 'Coupon code',
            title: 'Title',
            description: 'Description',
            discount_value: 'Discount value',
            min_order_amount: 'Minimum order',
            valid_from: 'Start date',
            valid_until: 'End date',
          })
        );
      },
    });
  }

  delete(id: string) {
    if (!confirm('Delete this coupon?')) return;
    this.deleting.set(id);
    this.api.deleteAdminCoupon(id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.load();
      },
      error: () => this.deleting.set(null),
    });
  }

  discountLabel(c: any): string {
    if (c.discount_type === 'percentage') return `${c.discount_value}% OFF`;
    if (c.discount_type === 'free_delivery') return 'FREE DELIVERY';
    return `Rs.${c.discount_value} OFF`;
  }

  scopeLabel(c: any): string {
    return c.vendor ? 'Vendor' : 'Platform';
  }

  isExpired(c: any): boolean {
    return c.valid_until && new Date(c.valid_until) < new Date();
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

  isCouponFormValid(): boolean {
    return (
      Object.keys(this.validateCouponForm()).length === 0 &&
      Object.keys(this.fieldErrors()).length === 0
    );
  }

  private validateCouponForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!this.form.code.trim()) errors['code'] = 'Coupon code is required.';
    else if (!/^[A-Z0-9_-]{3,50}$/i.test(this.form.code.trim()))
      errors['code'] =
        'Coupon code must be 3-50 letters, numbers, dashes, or underscores.';
    if (!this.form.title.trim()) errors['title'] = 'Coupon title is required.';
    if (!this.form.description.trim())
      errors['description'] = 'Description is required.';
    if (
      this.form.discount_type === 'percentage' &&
      (this.form.discount_value <= 0 || this.form.discount_value > 100)
    ) {
      errors['discount_value'] =
        'Percentage discount must be between 1 and 100.';
    }
    if (this.form.discount_type === 'fixed' && this.form.discount_value <= 0)
      errors['discount_value'] = 'Fixed discount must be greater than 0.';
    if (this.form.min_order_amount < 0)
      errors['min_order_amount'] = 'Minimum order cannot be negative.';
    if (
      this.form.max_discount_amount !== null &&
      this.form.max_discount_amount < 0
    )
      errors['max_discount_amount'] = 'Maximum discount cannot be negative.';
    if (this.form.usage_limit !== null && this.form.usage_limit < 1)
      errors['usage_limit'] = 'Usage limit must be at least 1.';
    if (this.form.per_user_limit < 1)
      errors['per_user_limit'] = 'Per-user limit must be at least 1.';
    if (!this.form.valid_from) errors['valid_from'] = 'Start date is required.';
    if (
      this.form.valid_until &&
      new Date(this.form.valid_until) <= new Date(this.form.valid_from)
    ) {
      errors['valid_until'] = 'End date must be after start date.';
    }
    return errors;
  }
}
