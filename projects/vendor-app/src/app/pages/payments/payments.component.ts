import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  errorMsg = signal('');
  payouts = signal<any[]>([]);

  ngOnInit() {
    this.loadPayouts();
  }

  loadPayouts() {
    this.loading.set(true);
    this.errorMsg.set('');
    
    this.api.getVendorPayouts().subscribe({
      next: (res) => {
        this.payouts.set(res.results || res);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Failed to load payout history.');
        this.loading.set(false);
      }
    });
  }

  downloadInvoice(payout: any) {
    const payload = {
      invoice_type: 'vendor_settlement',
      vendor: payout.vendor,
      amount: payout.net_payout || payout.gross_sales || payout.total_earnings,
      notes: `Settlement for period ${payout.period_start} to ${payout.period_end}`
    };
    
    this.api.generateInvoice(payload).subscribe({
      next: (inv) => {
        const url = this.api.downloadInvoiceUrl(inv.id);
        window.open(url, '_blank');
      },
      error: () => alert('Failed to generate invoice.')
    });
  }
}
