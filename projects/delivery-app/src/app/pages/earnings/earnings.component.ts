import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, AppCurrencyPipe, ToastService } from '@shared/public-api';
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-earnings',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe, FormsModule],
  templateUrl: './earnings.component.html',
  styleUrls: ['./earnings.component.scss']
})
export class EarningsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  
  earnings = signal<any[]>([]);
  payouts = signal<any[]>([]);
  loading = signal(true);
  totalEarnings = signal(0);
  monthEarnings = signal(0);

  // Decline Modal
  showDeclineModal = signal(false);
  decliningPayout = signal<any | null>(null);
  declineReason = '';

  activeTab = signal<'history' | 'payouts'>('history');

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    forkJoin({
      earnings: this.api.getDeliveryEarnings(),
      payouts: this.api.getDeliveryPartnerPayouts()
    }).subscribe({
      next: (res: any) => {
        const eList = res.earnings.results || res.earnings;
        this.earnings.set(eList);
        this.totalEarnings.set(eList.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0));
        
        const now = new Date();
        const monthList = eList.filter((e: any) => {
          const d = new Date(e.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        this.monthEarnings.set(monthList.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0));

        this.payouts.set(res.payouts.results || res.payouts);

        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // ── Payout Actions ──────────────────────────────────────────────────

  approvePayout(payout: any) {
    this.api.approveDeliveryPayout(payout.id).subscribe({
      next: () => {
        this.toast.show('Payout approved.', 'success');
        this.loadData();
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
    this.api.declineDeliveryPayout(payout.id, this.declineReason).subscribe({
      next: () => {
        this.toast.show('Payout declined.', 'success');
        this.closeDeclineModal();
        this.loadData();
      },
      error: (e: any) => this.toast.show(e.error?.error || 'Failed to decline payout.', 'error')
    });
  }

  verifyCredit(payout: any) {
    this.api.verifyDeliveryPayoutCredit(payout.id).subscribe({
      next: () => {
        this.toast.show('Credit verified successfully!', 'success');
        this.loadData();
      },
      error: (e: any) => this.toast.show(e.error?.error || 'Failed to verify credit.', 'error')
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending_approval: 'Pending Approval',
      approved:         'Approved',
      scheduled:        'Scheduled',
      paid:             'Verify Credit',
      verified:         'Verified ✓',
      failed:           'Failed'
    };
    return map[status] || status;
  }
}



