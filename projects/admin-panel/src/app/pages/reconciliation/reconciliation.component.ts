import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';

@Component({
  selector: 'app-reconciliation',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './reconciliation.component.html',
  styleUrl: './reconciliation.component.scss'
})
export class ReconciliationComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  payments = signal<any[]>([]);
  vendorPayouts = signal<any[]>([]);
  deliveryPayouts = signal<any[]>([]);
  errors = signal<string[]>([]);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.errors.set([]);
    let pending = 3;
    const done = () => {
      pending -= 1;
      if (pending === 0) this.loading.set(false);
    };

    this.api.getAdminPayments({ page_size: 100, ordering: '-placed_at' }).subscribe({
      next: (res) => { this.payments.set(res.results || res || []); done(); },
      error: () => { this.errors.update(e => [...e, 'Payments could not be loaded.']); done(); }
    });

    this.api.getAdminVendorPayouts({ page_size: 100 }).subscribe({
      next: (res) => { this.vendorPayouts.set(res.results || res || []); done(); },
      error: () => { this.errors.update(e => [...e, 'Vendor payouts could not be loaded.']); done(); }
    });

    this.api.getAdminDeliveryPayouts({ page_size: 100 }).subscribe({
      next: (res) => { this.deliveryPayouts.set(res.results || res || []); done(); },
      error: () => { this.errors.update(e => [...e, 'Delivery payouts could not be loaded.']); done(); }
    });
  }

  get collectedRevenue(): number {
    return this.payments().filter(p => p.is_payment_verified || p.payment_method === 'cod')
      .reduce((sum, p) => sum + Number(p.total || 0), 0);
  }

  get pendingPayments(): number {
    return this.payments().filter(p => p.payment_method === 'razorpay' && !p.is_payment_verified && p.status !== 'cancelled').length;
  }

  get vendorPayable(): number {
    return this.vendorPayouts().filter(p => ['pending_approval', 'approved', 'scheduled'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.net_payout || p.amount || 0), 0);
  }

  get deliveryPayable(): number {
    return this.deliveryPayouts().filter(p => ['pending', 'scheduled'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount || p.net_payout || 0), 0);
  }

  get exceptions(): any[] {
    return [
      ...this.payments().filter(p => p.payment_method === 'razorpay' && !p.is_payment_verified && p.status !== 'cancelled')
        .map(p => ({ type: 'Payment', label: `Order #${p.order_number}`, status: 'Unverified Razorpay payment', route: `/orders/${p.id}` })),
      ...this.vendorPayouts().filter(p => ['failed', 'declined'].includes(p.status))
        .map(p => ({ type: 'Vendor payout', label: p.vendor_name || p.id, status: p.status, route: '/payouts' })),
      ...this.deliveryPayouts().filter(p => ['failed', 'declined'].includes(p.status))
        .map(p => ({ type: 'Delivery payout', label: p.partner_name || p.id, status: p.status, route: '/payouts' }))
    ].slice(0, 12);
  }
}
