import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-payouts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payouts.component.html',
  styleUrl: './payouts.component.scss'
})
export class PayoutsComponent implements OnInit {
  private api = inject(ApiService);

  activeTab = signal<'vendors' | 'delivery'>('vendors');
  
  loading = signal(false);
  errorMsg = signal('');
  payouts = signal<any[]>([]);

  // For creating fake payouts (stub)
  creating = signal(false);
  createFormObj = { vendor_id: '', delivery_partner_id: '', amount: null, period_start: '', period_end: '' };

  ngOnInit() {
    this.loadPayouts();
  }

  setTab(tab: 'vendors' | 'delivery') {
    this.activeTab.set(tab);
    this.createFormObj = { vendor_id: '', delivery_partner_id: '', amount: null, period_start: '', period_end: '' };
    this.loadPayouts();
  }

  loadPayouts() {
    this.loading.set(true);
    this.errorMsg.set('');
    
    const req = this.activeTab() === 'vendors'
      ? this.api.getAdminVendorPayouts()
      : this.api.getAdminDeliveryPayouts();

    req.subscribe({
      next: (res) => {
        this.payouts.set(res.results || res);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set(`Failed to load ${this.activeTab()} payouts.`);
        this.loading.set(false);
      }
    });
  }

  markPaid(payout: any) {
    if (!confirm('Mark this payout as paid?')) return;
    
    const req = this.activeTab() === 'vendors'
      ? this.api.updateAdminVendorPayout(payout.id, { status: 'paid' })
      : this.api.updateAdminDeliveryPayout(payout.id, { status: 'paid' });

    req.subscribe({
      next: () => this.loadPayouts(),
      error: () => alert('Failed to change payout status.')
    });
  }

  submitPayout() {
    if (!this.createFormObj.amount || !this.createFormObj.period_start || !this.createFormObj.period_end) {
      alert('Fill all required fields');
      return;
    }
    
    this.creating.set(true);
    const isVendor = this.activeTab() === 'vendors';
    
    if (isVendor && !this.createFormObj.vendor_id) { alert('Vendor ID required'); this.creating.set(false); return; }
    if (!isVendor && !this.createFormObj.delivery_partner_id) { alert('Partner ID required'); this.creating.set(false); return; }

    const payload: any = {
      period_start: this.createFormObj.period_start,
      period_end: this.createFormObj.period_end,
      status: 'pending'
    };

    if (isVendor) {
      payload.vendor = this.createFormObj.vendor_id;
      payload.gross_sales = this.createFormObj.amount;
      payload.platform_commission = 0;
      payload.net_payout = this.createFormObj.amount;
    } else {
      payload.delivery_partner = this.createFormObj.delivery_partner_id;
      payload.total_deliveries = 1; // stub
      payload.total_earnings = this.createFormObj.amount;
    }

    const req = isVendor
      ? this.api.createAdminVendorPayout(payload)
      : this.api.createAdminDeliveryPayout(payload);

    req.subscribe({
      next: () => {
        this.creating.set(false);
        this.createFormObj = { vendor_id: '', delivery_partner_id: '', amount: null, period_start: '', period_end: '' };
        this.loadPayouts();
      },
      error: (err) => {
        alert(JSON.stringify(err.error));
        this.creating.set(false);
      }
    });
  }
}
