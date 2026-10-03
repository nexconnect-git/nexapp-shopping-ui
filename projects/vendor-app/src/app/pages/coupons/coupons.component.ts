import { CommonModule } from '@angular/common';
import { afterNextRender, Component, DestroyRef, effect, ElementRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  apiErrorMessage,
  AppCurrencyPipe,
  VendorCoupon,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
import { VendorContextService } from '../../services/vendor-context.service';
import { vendorListState } from '../../services/vendor-list-state';
interface CouponForm {
  code: string;
  title: string;
  description: string;
  discount_type: VendorCoupon['discount_type'];
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
  imports: [
    CommonModule,
    FormsModule,
    AppCurrencyPipe,
    WorkspaceDialogComponent,
    WorkspacePagerComponent,
  ],
  templateUrl: './coupons.component.html',
  styleUrl: './coupons.component.scss',
})
export class CouponsComponent implements OnInit {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  private readonly api = inject(VendorWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly context = inject(VendorContextService);
  readonly list = vendorListState<VendorCoupon>((query) =>
    this.api.coupons(query)
  );
  readonly search = signal('');
  readonly lifecycle = signal('');
  readonly editing = signal(false);
  readonly editId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly pending = signal<string | null>(null);
  readonly deleteCandidate = signal<VendorCoupon | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly limitsOpen = signal(false);
  constructor() {
    effect(() => {
      if (['min_order_amount', 'max_discount_amount', 'usage_limit', 'per_user_limit'].some(key => this.fieldErrors()[key])) this.limitsOpen.set(true);
    });
  }
  readonly statuses = [
    'active',
    'upcoming',
    'expired',
    'inactive',
    'exhausted',
  ];
  form: CouponForm = this.blank();
  private saved = '';
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.search.set(params.get('search') || '');
        this.lifecycle.set(params.get('lifecycle') || '');
        this.list.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.load();
      });
  }
  query(page = 1): void {
    void this.router.navigate([], {
      queryParams: {
        page,
        search: this.search() || null,
        lifecycle: this.lifecycle() || null,
      },
    });
  }
  load(): void {
    this.list.load({ search: this.search(), lifecycle: this.lifecycle() });
  }
  blank(): CouponForm {
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
      valid_from: '',
      valid_until: '',
      is_active: false,
    };
  }
  zone(): string {
    return this.context.context()?.timezone || '';
  }
  local(iso: string): string {
    if (!iso || !this.zone()) return '';
    const values = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: this.zone(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(iso))
        .map((part) => [part.type, part.value])
    );
    return `${values['year']}-${values['month']}-${values['day']}T${values['hour']}:${values['minute']}`;
  }
  toIso(local: string): string | null {
    if (!local) return null;
    const target = Date.parse(local + 'Z');
    if (!Number.isFinite(target))
      throw new Error('Enter a valid date and time.');
    let actual = target;
    for (let index = 0; index < 3; index++)
      actual +=
        target - Date.parse(this.local(new Date(actual).toISOString()) + 'Z');
    const result = new Date(actual).toISOString();
    if (this.local(result) !== local)
      throw new Error(
        'This local time does not exist in the store timezone. Choose another time.'
      );
    return result;
  }
  open(coupon?: VendorCoupon): void {
    if (!this.zone()) return;
    this.form = coupon
      ? {
          code: coupon.code,
          title: coupon.title,
          description: coupon.description,
          discount_type: coupon.discount_type,
          discount_value: Number(coupon.discount_value),
          min_order_amount: Number(coupon.min_order_amount),
          max_discount_amount:
            coupon.max_discount_amount === null
              ? null
              : Number(coupon.max_discount_amount),
          usage_limit: coupon.usage_limit,
          per_user_limit: coupon.per_user_limit,
          valid_from: this.local(coupon.valid_from),
          valid_until: coupon.valid_until ? this.local(coupon.valid_until) : '',
          is_active: coupon.is_active,
        }
      : { ...this.blank(), valid_from: this.local(new Date().toISOString()) };
    this.editId.set(coupon?.id || null);
    this.saved = JSON.stringify(this.form);
    this.error.set('');
    this.fieldErrors.set({});
    this.limitsOpen.set(false);
    this.editing.set(true);
  }
  hasUnsavedChanges(): boolean {
    return this.editing() && JSON.stringify(this.form) !== this.saved;
  }
  isSaving(): boolean {
    return this.saving() || !!this.pending();
  }
  close(): void {
    if (this.saving()) return;
    if (this.hasUnsavedChanges()) {
      this.error.set(
        'Unsaved edits remain. Save, or use Discard edits to close.'
      );
      return;
    }
    this.editing.set(false);
    this.error.set('');
    this.fieldErrors.set({});
  }
  discard(): void {
    if (this.saving()) return;
    this.editing.set(false);
    this.error.set('');
    this.fieldErrors.set({});
  }
  validateField(key: keyof CouponForm): void {
    const message = this.validationErrors()[key];
    this.fieldErrors.update(current => {
      const next = { ...current };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  }
  private validationErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!/^[A-Z0-9_-]{3,50}$/i.test(this.form.code))
      errors['code'] = 'Use 3–50 letters, numbers, dashes or underscores.';
    if (!this.form.title.trim()) errors['title'] = 'Title is required.';
    for (const key of ['discount_value', 'min_order_amount'] as const)
      if (!Number.isFinite(this.form[key]) || this.form[key] < 0)
        errors[key] = 'Use a non-negative number.';
    if (
      this.form.discount_type !== 'free_delivery' &&
      this.form.discount_value <= 0
    )
      errors['discount_value'] = 'Use a positive discount.';
    if (
      this.form.discount_type === 'percentage' &&
      this.form.discount_value > 100
    )
      errors['discount_value'] = 'Percentage cannot exceed 100.';
    if (
      this.form.max_discount_amount !== null &&
      (!Number.isFinite(this.form.max_discount_amount) ||
        this.form.max_discount_amount < 0)
    )
      errors['max_discount_amount'] = 'Use a non-negative amount.';
    for (const key of ['usage_limit', 'per_user_limit'] as const)
      if (
        this.form[key] !== null &&
        (!Number.isInteger(this.form[key]) || this.form[key]! < 1)
      )
        errors[key] = 'Use a whole number of at least 1.';
    if (!this.form.valid_from) errors['valid_from'] = 'Start date is required.';
    if (this.form.valid_until && this.form.valid_until <= this.form.valid_from)
      errors['valid_until'] = 'End must be after start.';
    return errors;
  }
  save(): void {
    if (this.saving() || !this.zone()) return;
    const errors = this.validationErrors();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      this.error.set('Fix the highlighted fields.');
      afterNextRender(() => {
        const invalid = this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
        invalid?.focus();
        invalid?.scrollIntoView({ block: 'center' });
      }, { injector: this.injector });
      return;
    }
    let from: string | null, until: string | null;
    try {
      from = this.toIso(this.form.valid_from);
      until = this.toIso(this.form.valid_until);
    } catch (failure) {
      this.error.set(
        failure instanceof Error ? failure.message : 'Invalid time.'
      );
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api
      .saveCoupon(this.editId(), {
        ...this.form,
        code: this.form.code.trim().toUpperCase(),
        discount_value:
          this.form.discount_type === 'free_delivery'
            ? 0
            : this.form.discount_value,
        valid_from: from,
        valid_until: until,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editing.set(false);
          this.success.set('Coupon saved.');
          this.load();
        },
        error: (failure) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(failure, 'Coupon was not saved.'));
        },
      });
  }
  command(coupon: VendorCoupon, command: 'duplicate' | 'reactivate'): void {
    if (this.pending()) return;
    this.pending.set(coupon.id);
    this.error.set('');
    this.api
      .couponCommand(coupon.id, command)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.pending.set(null);
          this.success.set(
            command === 'duplicate'
              ? 'Inactive copy created. Review its dates before activation.'
              : 'Coupon activated.'
          );
          this.load();
        },
        error: (failure) => {
          this.pending.set(null);
          this.error.set(apiErrorMessage(failure, 'Coupon was not changed.'));
        },
      });
  }
  remove(): void {
    const coupon = this.deleteCandidate();
    if (!coupon || this.pending()) return;
    this.pending.set(coupon.id);
    this.error.set('');
    this.api
      .deleteCoupon(coupon.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.pending.set(null);
          this.deleteCandidate.set(null);
          this.success.set('Coupon deleted.');
          if (this.list.page() > 1 && this.list.rows().length === 1)
            this.query(this.list.page() - 1);
          else this.load();
        },
        error: (failure) => {
          this.pending.set(null);
          this.error.set(apiErrorMessage(failure, 'Coupon was not deleted.'));
        },
      });
  }
  previewSubtotal = signal(500);
  preview(): number | null {
    const total = Number(this.previewSubtotal());
    if (
      !Number.isFinite(total) ||
      total < 0 ||
      total < this.form.min_order_amount
    )
      return null;
    if (this.form.discount_type === 'free_delivery') return 0;
    let discount =
      this.form.discount_type === 'percentage'
        ? (total * this.form.discount_value) / 100
        : this.form.discount_value;
    if (this.form.max_discount_amount)
      discount = Math.min(discount, this.form.max_discount_amount);
    return Math.max(0, Math.min(discount, total));
  }
}
