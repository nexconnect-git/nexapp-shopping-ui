import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe, DatePipe, FormsModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
})
export class PaymentsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  payouts = signal<any[]>([]);
  activeTab = signal<
    'all' | 'pending_approval' | 'scheduled' | 'paid' | 'failed' | 'ledger'
  >('all');

  // Decline modal
  showDeclineModal = signal(false);
  decliningPayout = signal<any | null>(null);
  declineReason = '';
  actionId = signal<string | null>(null);
  downloadingId = signal<string | null>(null);

  // Computed slices
  pendingApproval = computed(() =>
    this.payouts().filter((p) => p.status === 'pending_approval'),
  );
  pendingVerify = computed(() =>
    this.payouts().filter((p) => p.status === 'paid'),
  );
  filteredPayouts = computed(() => {
    const tab = this.activeTab();
    if (tab === 'all' || tab === 'ledger') return this.payouts();
    if (tab === 'failed')
      return this.payouts().filter((p) =>
        ['failed', 'declined'].includes(p.status),
      );
    return this.payouts().filter((p) => p.status === tab);
  });

  payoutTabs = [
    { key: 'all', label: 'All' },
    { key: 'pending_approval', label: 'Pending approval' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'paid', label: 'Paid / verify credit' },
    { key: 'failed', label: 'Failed / declined' },
    { key: 'ledger', label: 'Ledger' },
  ] as const;

  readonly payoutSetupItems = [
    {
      title: 'Bank and KYC setup',
      description:
        'Add bank account and verification details when backend support is enabled.',
      status: 'Not connected',
    },
    {
      title: 'Payout review',
      description:
        'Platform settlements may require vendor approval before they are scheduled.',
      status: 'Review payouts',
    },
    {
      title: 'Credit verification',
      description:
        'After a payout is marked paid, verify the credit once it reaches your account.',
      status: 'Verify when paid',
    },
  ];

  ngOnInit() {
    this.loadPayouts();
  }

  loadPayouts() {
    this.loading.set(true);
    this.api.getVendorPayouts().subscribe({
      next: (res: any) => {
        this.payouts.set(res.results || res);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load payout history.', 'error');
        this.loading.set(false);
      },
    });
  }

  // ── Payout lifecycle ──────────────────────────────────────────

  approvePayout(payout: any) {
    this.actionId.set(payout.id);
    this.api.approvePayout(payout.id).subscribe({
      next: () => {
        this.actionId.set(null);
        this.toast.show('Payout approved successfully.', 'success');
        this.loadPayouts();
      },
      error: (e: any) => {
        this.actionId.set(null);
        this.toast.show(e.error?.error || 'Failed to approve payout.', 'error');
      },
    });
  }

  openDeclineModal(payout: any) {
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
    if (!this.declineReason.trim()) {
      this.toast.show('Decline reason is required.', 'error');
      return;
    }
    this.actionId.set(payout.id);
    this.api.declinePayout(payout.id, this.declineReason).subscribe({
      next: () => {
        this.actionId.set(null);
        this.toast.show('Payout declined.', 'success');
        this.closeDeclineModal();
        this.loadPayouts();
      },
      error: (e: any) => {
        this.actionId.set(null);
        this.toast.show(e.error?.error || 'Failed to decline payout.', 'error');
      },
    });
  }

  verifyCredit(payout: any) {
    this.actionId.set(payout.id);
    this.api.verifyPayoutCredit(payout.id).subscribe({
      next: () => {
        this.actionId.set(null);
        this.toast.show(
          'Credit verified! Your sales report has been updated.',
          'success',
        );
        this.loadPayouts();
      },
      error: (e: any) => {
        this.actionId.set(null);
        this.toast.show(e.error?.error || 'Failed to verify credit.', 'error');
      },
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending_approval: 'Pending Your Approval',
      approved: 'Approved',
      scheduled: 'Scheduled',
      paid: 'Verify Credit',
      verified: 'Verified ✓',
      failed: 'Declined',
    };
    return map[status] || status;
  }

  activeTabDescription(): string {
    const map: Record<string, string> = {
      all: 'All settlement records across approval, scheduling, payment, verification, and exceptions.',
      pending_approval:
        'Payouts waiting for your review before platform processing continues.',
      scheduled: 'Approved payouts queued for transfer by the platform.',
      paid: 'Transfers sent by the platform. Verify the credit after it lands in your bank account.',
      failed:
        'Declined or failed payouts that need admin follow-up before they can be retried.',
      ledger: 'Your payout ledger: every settlement record in one audit trail.',
    };
    return map[this.activeTab()];
  }

  emptyStateMessage(): string {
    if (this.activeTab() === 'all' || this.activeTab() === 'ledger') {
      return 'Payouts will appear after completed orders are settled by the platform.';
    }
    return `No ${this.activeTabDescription().toLowerCase()}`;
  }

  // ── Invoice download ──────────────────────────────────────────

  downloadInvoice(payout: any) {
    this.downloadingId.set(payout.id);
    const payload = {
      invoice_type: 'vendor_settlement',
      vendor: payout.vendor,
      amount: payout.net_payout || payout.gross_sales || payout.total_earnings,
      notes: `Settlement for period ${payout.period_start} to ${payout.period_end}`,
    };

    this.api.generateInvoice(payload).subscribe({
      next: (inv: any) => {
        this.api.downloadInvoice(inv.id).subscribe({
          next: (blob: Blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `settlement-${payout.period_start}-${payout.period_end}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            this.downloadingId.set(null);
          },
          error: () => {
            this.downloadingId.set(null);
            this.toast.show('Failed to download invoice.', 'error');
          },
        });
      },
      error: () => {
        this.downloadingId.set(null);
        this.toast.show('Failed to generate invoice.', 'error');
      },
    });
  }
}
