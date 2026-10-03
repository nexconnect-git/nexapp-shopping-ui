import {
  Component,
  DestroyRef,
  inject,
  input,
  OnChanges,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import {
  AdminProfileContext,
  ApiService,
  AppCurrencyPipe,
  ToastService,
} from '@shared/public-api';
import { AdminAccessService } from '../services/admin-access.service';
@Component({
  selector: 'app-profile-context',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DialogModule,
    AppCurrencyPipe,
  ],
  templateUrl: './profile-context.component.html',
  styleUrl: './profile-context.component.scss',
})
export class ProfileContextComponent implements OnChanges {
  entityType = input.required<string>();
  entityId = input.required<string>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  access = inject(AdminAccessService);
  private destroyRef = inject(DestroyRef);
  private loadRequest?: Subscription;
  context = signal<AdminProfileContext | null>(null);
  loading = signal(false);
  error = signal('');
  saving = signal(false);
  resetOpen = false;
  reason = '';
  documentReview: NonNullable<AdminProfileContext['documents']>[number] | null =
    null;
  documentExpiry = '';
  documentDecision: 'verify' | 'reject' = 'verify';
  documentReason = '';
  openDocument(doc: NonNullable<AdminProfileContext['documents']>[number]) {
    this.documentReview = doc;
    this.documentExpiry = doc.expires_on || '';
    this.documentDecision = 'verify';
    this.documentReason = '';
  }
  reviewDocument() {
    if (!this.documentReview || this.saving()) return;
    this.saving.set(true);
    this.api
      .verifyVendorDocument(
        this.entityId(),
        this.documentReview.id,
        this.documentDecision,
        this.documentReason,
        this.documentExpiry
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.documentReview = null;
          this.toast.show('Document review saved.', 'success');
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.show(
            error.error?.expires_on?.[0] ||
              error.error?.detail ||
              'Document review could not be saved. Check expiry and decision.',
            'error'
          );
        },
      });
  }
  ngOnChanges() {
    this.load();
  }
  load() {
    if (!this.entityId()) return;
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.loadRequest = this.api
      .getAdminProfileContext(this.entityType(), this.entityId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.context.set(response);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load related account operations.');
          this.loading.set(false);
        },
      });
  }
  metricRows() {
    const metrics = this.context()?.metrics || {};
    return [
      { label: 'Total orders', value: metrics['total_orders'] },
      { label: 'Completed', value: metrics['completed_orders'] },
      { label: 'Active orders', value: metrics['active_orders'] },
      { label: 'Cancelled', value: metrics['cancelled_orders'] },
    ];
  }
  orderRoute() {
    return '/orders';
  }
  orderParams() {
    return {
      [this.entityType() === 'vendor'
        ? 'vendor'
        : this.entityType() === 'customer'
        ? 'customer'
        : 'delivery_partner']: this.entityId(),
    };
  }
  queryParams(route: string) {
    return Object.fromEntries(new URLSearchParams(route.split('?')[1] || ''));
  }
  sendReset() {
    const user = this.context()?.user;
    if (!user || this.saving()) return;
    this.saving.set(true);
    this.api
      .initiateAdminPasswordReset(user.id, this.reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          this.resetOpen = false;
          this.toast.show(response.detail, 'success');
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.show(
            error.error?.detail ||
              'Could not send reset email. Check account eligibility and email service.',
            'error'
          );
        },
      });
  }
}
