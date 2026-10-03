import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import {
  apiErrorMessage,
  ApiService,
  AppCurrencyPipe,
} from '@shared/public-api';
import { AdminAccessService } from '../services/admin-access.service';

interface RefundRecord {
  id: string;
  order: string;
  order_number: string;
  customer_name: string;
  amount: number;
  method: string;
  status: string;
  reason: string;
  gateway_refund_id: string;
  created_at: string;
  failure_reason: string;
}

@Component({
  selector: 'app-refund-ledger',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DialogModule,
    TableModule,
    AppCurrencyPipe,
  ],
  templateUrl: './refund-ledger.component.html',
  styles: [`:host { display: block; min-width: 0; } .refund-status-filter { display: grid; gap: 6px; max-width: 220px; margin: 16px 0; } :host .money-column { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; } :host .action-column { text-align: right; }`],
})
export class RefundLedgerComponent implements OnInit {
  readonly orderId = input('');
  readonly access = inject(AdminAccessService);
  private api = inject(ApiService);
  private destroy = inject(DestroyRef);
  rows = signal<RefundRecord[]>([]);
  total = signal(0);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  visible = false;
  status = '';
  page = 1;
  selected: RefundRecord | null = null;
  form = {
    order: '',
    amount: 0,
    method: 'manual',
    reason: '',
    status: 'requested',
    gateway_refund_id: '',
    failure_reason: '',
  };
  ngOnInit() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getAdminRefundLedger({
        page: this.page,
        status: this.status,
        ...(this.orderId() ? { order: this.orderId() } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (res) => {
          this.rows.set(res.results);
          this.total.set(res.count);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(
            apiErrorMessage(err, 'Could not load refund records.')
          );
          this.loading.set(false);
        },
      });
  }
  open(record: RefundRecord | null = null) {
    this.selected = record;
    this.error.set('');
    this.form = record
      ? {
          order: record.order,
          amount: Number(record.amount),
          method: record.method,
          reason: record.reason,
          status: record.status,
          gateway_refund_id: record.gateway_refund_id,
          failure_reason: record.failure_reason,
        }
      : {
          order: this.orderId(),
          amount: 0,
          method: 'manual',
          reason: '',
          status: 'requested',
          gateway_refund_id: '',
          failure_reason: '',
        };
    this.visible = true;
  }
  choices() {
    return this.selected
      ? (
          {
            requested: ['requested', 'approved', 'cancelled'],
            approved: ['approved', 'processing', 'cancelled'],
            processing: ['processing', 'processed', 'failed'],
            failed: ['failed', 'processing', 'cancelled'],
          } as Record<string, string[]>
        )[this.selected.status] || [this.selected.status]
      : ['requested'];
  }
  save() {
    if (this.busy() || !this.access.can('finance.manage')) return;
    this.busy.set(true);
    this.error.set('');
    const request = this.selected
      ? this.api.updateAdminRefund(this.selected.id, {
          status: this.form.status,
          reason: this.form.reason,
          gateway_refund_id: this.form.gateway_refund_id,
          failure_reason: this.form.failure_reason,
        })
      : this.api.createAdminRefund({ ...this.form });
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.busy.set(false);
        this.visible = false;
        this.notice.set(
          'Refund record saved. No money was transferred by this action.'
        );
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(
          apiErrorMessage(err, 'Could not save the refund record.')
        );
      },
    });
  }
  export(type: 'payments' | 'refunds') {
    this.error.set('');
    this.api
      .exportAdminFinance(type)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `nextou-${type}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (err) => this.error.set(apiErrorMessage(err, 'Export failed.')),
      });
  }
}
