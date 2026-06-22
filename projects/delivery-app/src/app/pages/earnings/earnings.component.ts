import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertService,
  apiErrorMessage,
  AppCurrencyPipe,
  DeliveryApi,
} from '@shared/public-api';
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface EarningItem {
  id: string;
  amount: string;
  is_paid: boolean;
  created_at: string;
  order?: string;
  order_number?: string;
}

interface PayoutItem {
  id: string;
  status: string;
  period_start: string;
  period_end: string;
  total_earnings: string;
  paid_at?: string | null;
}

@Component({
  selector: 'app-earnings',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe, FormsModule],
  templateUrl: './earnings.component.html',
  styleUrls: ['./earnings.component.scss'],
})
export class EarningsComponent implements OnInit {
  private api = inject(DeliveryApi);
  private alerts = inject(AlertService);

  earnings = signal<EarningItem[]>([]);
  payouts = signal<PayoutItem[]>([]);
  loading = signal(true);
  totalEarnings = signal(0);
  monthEarnings = signal(0);

  // Decline Modal
  showDeclineModal = signal(false);
  decliningPayout = signal<PayoutItem | null>(null);
  declineReason = '';

  activeTab = signal<'history' | 'payouts'>('history');

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    forkJoin({
      earnings: this.api.getDeliveryEarnings(),
      payouts: this.api.getDeliveryPartnerPayouts(),
    }).subscribe({
      next: (res: { earnings: { results?: EarningItem[] } | EarningItem[]; payouts: { results?: PayoutItem[] } | PayoutItem[] }) => {
        const eList = (res.earnings as { results?: EarningItem[] }).results || (res.earnings as EarningItem[]);
        this.earnings.set(eList);
        this.totalEarnings.set(
          eList.reduce((s: number, e) => s + parseFloat(e.amount || '0'), 0),
        );

        const now = new Date();
        const monthList = eList.filter((e) => {
          const d = new Date(e.created_at);
          return (
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          );
        });
        this.monthEarnings.set(
          monthList.reduce(
            (s: number, e) => s + parseFloat(e.amount || '0'),
            0,
          ),
        );

        this.payouts.set((res.payouts as { results?: PayoutItem[] }).results || (res.payouts as PayoutItem[]));

        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.alerts.error('Could not load earnings and payouts.');
      },
    });
  }

  // ── Payout Actions ──────────────────────────────────────────────────

  approvePayout(payout: PayoutItem) {
    this.api.approveDeliveryPayout(payout.id).subscribe({
      next: () => {
        this.alerts.success('Payout approved.');
        this.loadData();
      },
      error: (e: { error?: { error?: string } }) =>
        this.alerts.error(apiErrorMessage(e, 'Failed to approve payout.')),
    });
  }

  openDeclineModal(payout: PayoutItem) {
    this.decliningPayout.set(payout);
    this.declineReason = '';
    this.showDeclineModal.set(true);
  }

  closeDeclineModal() {
    this.showDeclineModal.set(false);
    this.decliningPayout.set(null);
    this.declineReason = '';
  }

  confirmDecline() {
    const payout = this.decliningPayout();
    if (!payout) return;
    this.api.declineDeliveryPayout(payout.id, this.declineReason).subscribe({
      next: () => {
        this.alerts.success('Payout declined.');
        this.closeDeclineModal();
        this.loadData();
      },
      error: (e: { error?: { error?: string } }) =>
        this.alerts.error(apiErrorMessage(e, 'Failed to decline payout.')),
    });
  }

  handleDeclineBackdrop(event: MouseEvent) {
    if (event.target !== event.currentTarget) return;
    this.closeDeclineModal();
  }

  @HostListener('document:keydown.escape')
  closeDeclineOnEscape() {
    if (this.showDeclineModal()) this.closeDeclineModal();
  }

  verifyCredit(payout: PayoutItem) {
    this.api.verifyDeliveryPayoutCredit(payout.id).subscribe({
      next: () => {
        this.alerts.success('Credit verified successfully.');
        this.loadData();
      },
      error: (e: { error?: { error?: string } }) =>
        this.alerts.error(apiErrorMessage(e, 'Failed to verify credit.')),
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending_approval: 'Pending Approval',
      approved: 'Approved',
      scheduled: 'Scheduled',
      paid: 'Verify Credit',
      verified: 'Verified ✓',
      failed: 'Failed',
    };
    return map[status] || status;
  }
}
