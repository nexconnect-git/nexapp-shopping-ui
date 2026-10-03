import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  AuthService,
  VendorOrderCommand,
} from '@shared/public-api';
import { VendorOrdersStore } from '../../services/vendor-orders.store';
interface Checklist {
  [id: string]: { signature: string; checked: boolean };
}
@Component({
  selector: 'app-order-prep',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './order-prep.component.html',
  styleUrl: './order-prep.component.scss',
})
export class OrderPrepComponent implements OnInit {
  readonly store = inject(VendorOrdersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly id = signal('');
  readonly order = computed(() => this.store.records().get(this.id()) || null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly checklist = signal<Checklist>({});
  readonly storageError = signal('');
  otp = '';
  readonly otpError = signal('');
  readonly progress = computed(() => {
    const order = this.order();
    if (!order?.items.length) return 0;
    return Math.round(
      (100 *
        order.items.filter((item) => this.checklist()[item.id]?.checked)
          .length) /
        order.items.length
    );
  });
  readonly elapsed = computed(() =>
    Math.max(
      0,
      Math.floor(
        (this.store.clock() -
          Date.parse(this.order()?.placed_at || new Date().toISOString())) /
          60000
      )
    )
  );
  readonly actions: { key: VendorOrderCommand; label: string }[] = [
    { key: 'accept', label: 'Accept order' },
    { key: 'start_preparing', label: 'Start preparing' },
    { key: 'mark_ready', label: 'Mark ready' },
    { key: 'start_delivery_search', label: 'Find driver' },
    { key: 'cancel_delivery_search', label: 'Cancel driver search' },
  ];
  constructor() {
    effect(() => {
      const order = this.order();
      if (!order) return;
      if (['delivered', 'cancelled'].includes(order.status)) {
        this.checklist.set({});
        try {
          localStorage.removeItem(this.key());
        } catch {
          this.storageError.set(
            'Could not clear completed checklist progress.'
          );
        }
        return;
      }
      const existing = untracked(this.checklist);
      const next: Checklist = {};
      for (const item of order.items) {
        const signature =
          item.id + ':' + item.quantity + ':' + item.product_price;
        next[item.id] = {
          signature,
          checked:
            existing[item.id]?.signature === signature &&
            existing[item.id].checked,
        };
      }
      this.checklist.set(next);
    });
  }
  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.id.set(params.get('id') || '');
        try {
          const saved: unknown = JSON.parse(
            localStorage.getItem(this.key()) || '{}'
          );
          this.checklist.set(
            typeof saved === 'object' && saved ? (saved as Checklist) : {}
          );
        } catch {
          this.checklist.set({});
        }
        this.load();
      });
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.store
      .fetch(this.id())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.loading.set(false),
        error: (error) => {
          this.error.set(
            apiErrorMessage(error, 'Preparation details could not be loaded.')
          );
          this.loading.set(false);
        },
      });
  }
  toggle(id: string, checked: boolean): void {
    const current = this.checklist()[id];
    if (!current) return;
    this.checklist.update((list) => ({
      ...list,
      [id]: { ...current, checked },
    }));
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.checklist()));
      this.storageError.set('');
    } catch {
      this.storageError.set(
        'This browser could not save checklist progress. It may reset after reload.'
      );
    }
  }
  run(action: VendorOrderCommand): void {
    this.store
      .run(this.id(), action)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ error: () => {} });
  }
  verify(): void {
    if (!/^\d{6}$/.test(this.otp)) {
      this.otpError.set('Enter the six-digit pickup code.');
      return;
    }
    this.otpError.set('');
    this.store
      .run(this.id(), 'verify_pickup_otp', { otp: this.otp })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => (this.otp = ''),
        error: (error) =>
          this.otpError.set(apiErrorMessage(error, 'Pickup was not verified.')),
      });
  }
  private key(): string {
    return 'vendor-prep:' + this.auth.user()?.id + ':' + this.id();
  }
}
