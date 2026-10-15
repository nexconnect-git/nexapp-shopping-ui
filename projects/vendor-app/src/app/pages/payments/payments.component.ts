import { CounterStateComponent } from '../../components/counter-state.component';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  AppCurrencyPipe,
  VendorPayout,
  VendorPayoutPage,
  VendorWorkspaceApi,
} from '@shared/public-api';
import { VendorContextService } from '../../services/vendor-context.service';
import { vendorListState } from '../../services/vendor-list-state';
import { WorkspacePagerComponent } from '../../components/workspace-pager.component';
import { WorkspaceDialogComponent } from '../../components/workspace-dialog.component';
type PayoutAction = 'approve' | 'decline' | 'verify-credit';
@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CounterStateComponent,
    CommonModule,
    FormsModule,
    RouterLink,
    AppCurrencyPipe,
    WorkspacePagerComponent,
    WorkspaceDialogComponent,
  ],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
})
export class PaymentsComponent implements OnInit {
  private readonly api = inject(VendorWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly store = inject(VendorContextService);
  readonly list = vendorListState<VendorPayout, VendorPayoutPage>((query) =>
    this.api.payouts(query)
  );
  readonly status = signal('');
  readonly selected = signal<VendorPayout | null>(null);
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly rowErrors = signal<Record<string, string>>({});
  readonly dialog = signal<{
    payout: VendorPayout;
    action: PayoutAction;
  } | null>(null);
  reason = '';
  search = '';
  readonly statuses = [
    { key: '', label: 'All' },
    { key: 'pending_approval', label: 'Needs approval' },
    { key: 'approved', label: 'Approved' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'paid', label: 'Verify credit' },
    { key: 'verified', label: 'Verified' },
    { key: 'failed', label: 'Failed / declined' },
  ];
  readonly summary = computed(() => this.list.response()?.payout_summary || []);
  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        this.list.page.set(Math.max(1, Number(params.get('page')) || 1));
        this.status.set(params.get('status') || '');
        this.search = params.get('search') || '';
        this.load();
      });
  }
  query(page = 1): void {
    void this.router.navigate([], {
      queryParams: {
        page,
        status: this.status() || null,
        search: this.search || null,
      },
    });
  }
  filter(value: string): void {
    this.status.set(value);
    this.query();
  }
  load(): void {
    this.list.load({ status: this.status(), search: this.search });
  }
  label(payout: VendorPayout): string {
    return payout.status === 'failed' && payout.vendor_rejection_reason
      ? 'Declined by vendor'
      : this.statuses.find((status) => status.key === payout.status)?.label ||
          payout.status;
  }
  open(payout: VendorPayout, action: PayoutAction): void {
    this.reason = '';
    this.dialog.set({ payout, action });
  }
  act(): void {
    const target = this.dialog();
    if (
      !target ||
      this.pending().has(target.payout.id) ||
      (target.action === 'decline' && !this.reason.trim())
    )
      return;
    this.setPending(target.payout.id, true);
    this.rowErrors.update((errors) => ({ ...errors, [target.payout.id]: '' }));
    this.api
      .payoutCommand(target.payout.id, target.action, this.reason.trim())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.dialog.set(null);
          this.setPending(target.payout.id, false);
          this.load();
        },
        error: (error) => {
          this.rowErrors.update((errors) => ({
            ...errors,
            [target.payout.id]: apiErrorMessage(
              error,
              'Settlement action failed.'
            ),
          }));
          this.setPending(target.payout.id, false);
          this.load();
        },
      });
  }
  download(payout: VendorPayout): void {
    const id = 'download:' + payout.id;
    if (this.pending().has(id)) return;
    this.setPending(id, true);
    this.api
      .payoutStatement(payout.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob),
            anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'settlement-' + payout.id + '.pdf';
          anchor.click();
          URL.revokeObjectURL(url);
          this.setPending(id, false);
        },
        error: (error) => {
          this.rowErrors.update((errors) => ({
            ...errors,
            [payout.id]: apiErrorMessage(
              error,
              'Statement download failed. Retry.'
            ),
          }));
          this.setPending(id, false);
        },
      });
  }
  private setPending(id: string, value: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
