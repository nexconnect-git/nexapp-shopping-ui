import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe, DatePipe, FormsModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  payouts = signal<any[]>([]);

  // Decline modal
  showDeclineModal = signal(false);
  decliningPayout = signal<any | null>(null);
  declineReason = '';

  // Computed slices
  pendingApproval = computed(() => this.payouts().filter(p => p.status === 'pending_approval'));
  pendingVerify  = computed(() => this.payouts().filter(p => p.status === 'paid'));

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
      }
    });
  }

  // ── Payout lifecycle ──────────────────────────────────────────

  approvePayout(payout: any) {
    this.api.approvePayout(payout.id).subscribe({
      next: () => {
        this.toast.show('Payout approved successfully.', 'success');
        this.loadPayouts();
      },
      error: (e: any) => this.toast.show(e.error?.error || 'Failed to approve payout.', 'error')
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
    this.api.declinePayout(payout.id, this.declineReason).subscribe({
      next: () => {
        this.toast.show('Payout declined.', 'success');
        this.closeDeclineModal();
        this.loadPayouts();
      },
      error: (e: any) => this.toast.show(e.error?.error || 'Failed to decline payout.', 'error')
    });
  }

  verifyCredit(payout: any) {
    this.api.verifyPayoutCredit(payout.id).subscribe({
      next: () => {
        this.toast.show('Credit verified! Your sales report has been updated.', 'success');
        this.loadPayouts();
      },
      error: (e: any) => this.toast.show(e.error?.error || 'Failed to verify credit.', 'error')
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending_approval: 'Pending Your Approval',
      approved:         'Approved',
      scheduled:        'Scheduled',
      paid:             'Verify Credit',
      verified:         'Verified ✓',
      failed:           'Declined' };
    return map[status] || status;
  }

  // ── Invoice download ──────────────────────────────────────────

  downloadInvoice(payout: any) {
    const payload = {
      invoice_type: 'vendor_settlement',
      vendor: payout.vendor,
      amount: payout.net_payout || payout.gross_sales || payout.total_earnings,
      notes: `Settlement for period ${payout.period_start} to ${payout.period_end}`
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
          },
          error: () => this.toast.show('Failed to download invoice.', 'error')
        });
      },
      error: () => this.toast.show('Failed to generate invoice.', 'error')
    });
  }
}


