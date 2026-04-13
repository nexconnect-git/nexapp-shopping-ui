import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

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
}

@Component({
  selector: 'app-coupons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coupons.component.html',
  styleUrl: './coupons.component.scss'
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

  // Pagination
  page = signal(1);
  total = signal(0);
  totalPages = signal(1);
  readonly pageSize = 20;
  Math = Math;

  form: CouponForm = this.blankForm();

  readonly discountTypes = [
    { value: 'percentage', label: 'Percentage (%)' },
    { value: 'fixed',      label: 'Fixed Amount (₦)' },
    { value: 'free_delivery', label: 'Free Delivery' },
  ];

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getVendorCoupons({ page: this.page() }).subscribe({
      next: (res) => {
        this.coupons.set(res.results || res);
        this.total.set(res.count || (res.results || res).length);
        this.totalPages.set(Math.ceil((res.count || (res.results || res).length) / this.pageSize) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setPage(p: number) {
    if (p >= 1 && p <= this.totalPages()) { this.page.set(p); this.load(); }
  }

  pageNumbers(): number[] {
    const total = this.totalPages();
    const cur = this.page();
    const range: number[] = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) range.push(i);
    return range;
  }

  blankForm(): CouponForm {
    const now = new Date();
    const later = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    return {
      code: '', title: '', description: '',
      discount_type: 'percentage', discount_value: 10,
      min_order_amount: 0, max_discount_amount: null,
      usage_limit: null, per_user_limit: 1,
      valid_from: now.toISOString().slice(0, 16),
      valid_until: later.toISOString().slice(0, 16),
      is_active: true };
  }

  openCreate() {
    this.form = this.blankForm();
    this.editingId.set(null);
    this.error.set('');
    this.showForm.set(true);
  }

  openEdit(c: any) {
    this.form = {
      code: c.code, title: c.title, description: c.description || '',
      discount_type: c.discount_type, discount_value: c.discount_value,
      min_order_amount: c.min_order_amount, max_discount_amount: c.max_discount_amount,
      usage_limit: c.usage_limit, per_user_limit: c.per_user_limit,
      valid_from: c.valid_from?.slice(0, 16) || '',
      valid_until: c.valid_until?.slice(0, 16) || '',
      is_active: c.is_active };
    this.editingId.set(c.id);
    this.error.set('');
    this.showForm.set(true);
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    const payload = {
      ...this.form,
      code: this.form.code.trim().toUpperCase(),
      valid_from: new Date(this.form.valid_from).toISOString(),
      valid_until: this.form.valid_until ? new Date(this.form.valid_until).toISOString() : null };
    const req = this.editingId()
      ? this.api.updateVendorCoupon(this.editingId()!, payload)
      : this.api.createVendorCoupon(payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.success.set(this.editingId() ? 'Coupon updated.' : 'Coupon created.');
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        const data = err.error;
        this.error.set(typeof data === 'object' ? JSON.stringify(data) : 'Failed to save coupon.');
      } });
  }

  delete(id: string) {
    if (!confirm('Delete this coupon?')) return;
    this.deleting.set(id);
    this.api.deleteVendorCoupon(id).subscribe({
      next: () => { this.deleting.set(null); this.load(); },
      error: () => this.deleting.set(null) });
  }

  discountLabel(c: any): string {
    if (c.discount_type === 'percentage') return `${c.discount_value}% OFF`;
    if (c.discount_type === 'free_delivery') return 'FREE DELIVERY';
    return `₦${c.discount_value} OFF`;
  }

  isExpired(c: any): boolean {
    return c.valid_until && new Date(c.valid_until) < new Date();
  }
}
