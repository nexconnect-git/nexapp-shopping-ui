import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { CommonModule, DecimalPipe, TitleCasePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, ToastService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

@Component({
  selector: 'app-payouts',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe, DecimalPipe, TitleCasePipe, DatePipe, DynamicTableComponent, TableCellDirective],
  templateUrl: './payouts.component.html',
  styleUrl: './payouts.component.scss'
})
export class PayoutsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  // ── Tabs & lists ─────────────────────────────────────────────
  activeTab = signal<'vendors' | 'delivery'>('vendors');
  loading = signal(false);
  payouts = signal<any[]>([]);
  totalItems = signal(0);
  page = signal(1);

  get tableColumns() {
    if (this.activeTab() === 'vendors') {
      return [
        { key: 'id', label: 'ID', flex: '0.5fr' },
        { key: 'entity', label: 'Vendor', flex: '1.5fr' },
        { key: 'period', label: 'Period', flex: '1.5fr' },
        { key: 'gross', label: 'Gross Sales', flex: '1fr' },
        { key: 'commission', label: 'Commission', flex: '1fr' },
        { key: 'net', label: 'Net Payout', flex: '1fr' },
        { key: 'status', label: 'Status', flex: '1fr' },
        { key: 'actions', label: 'Actions', flex: '1.5fr' }
      ];
    } else {
      return [
        { key: 'id', label: 'ID', flex: '0.5fr' },
        { key: 'entity', label: 'Partner', flex: '1.5fr' },
        { key: 'period', label: 'Period', flex: '1.5fr' },
        { key: 'net', label: 'Net Payout', flex: '1fr' },
        { key: 'status', label: 'Status', flex: '1fr' },
        { key: 'actions', label: 'Actions', flex: '1.5fr' }
      ];
    }
  }

  vendors = signal<any[]>([]);
  partners = signal<any[]>([]);
  vendorsLoading = signal(false);
  partnersLoading = signal(false);

  // ── Create/Edit modal state ───────────────────────────────────
  showModal = signal(false);
  creating = signal(false);
  isEditMode = signal(false);
  editingId = signal<string | null>(null);

  createFormObj = {
    vendor_id: '',
    delivery_partner_id: '',
    amount: null as number | null,
    period_start: '',
    period_end: ''
  };

  // ── Selected vendor & bank details ───────────────────────────
  selectedVendor = signal<any | null>(null);
  vendorBank = signal<any | null>(null);
  bankLoading = signal(false);

  // ── Vendor sales summary (auto-fetched on date+vendor change) ─
  vendorSalesSummary = signal<any | null>(null);
  loadingSales = signal(false);

  // ── Computed commission values ────────────────────────────────
  commissionPct = computed(() => {
    const bank = this.vendorBank();
    return bank ? parseFloat(bank.commission_percentage) : 0;
  });

  commissionAmt = computed(() => {
    const gross = this.createFormObj.amount ?? 0;
    return (gross * this.commissionPct()) / 100;
  });

  netPayout = computed(() => {
    const gross = this.createFormObj.amount ?? 0;
    return gross - this.commissionAmt();
  });

  // ── Invoice state ─────────────────────────────────────────────
  invoicePayout = signal<any | null>(null);
  invoiceBank = signal<any | null>(null);
  today = new Date();

  // ── Send Payment modal ────────────────────────────────────────
  showSendModal = signal(false);
  sendingPaymentPayout = signal<any | null>(null);
  transactionRefInput = '';
  sendingPayment = signal(false);

  // ── Force Paid modal ──────────────────────────────────────────
  showForcePaidModal = signal(false);
  forcePaidPayout = signal<any | null>(null);
  forcingPaid = signal(false);

  // ── Delivery earnings helpers ─────────────────────────────────
  calculatingDeliveryEarnings = signal(false);
  deliveryDeliveriesCount = signal(0);

  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;

  ngOnInit() {
    this.loadVendors();
    this.loadPartners();
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload() && !this.showModal() && !this.showSendModal() && !this.showForcePaidModal()) {
        this.loadPayouts();
      }
    });
  }

  ngOnDestroy() { this.reloadSub?.unsubscribe(); }

  manualReload() { this.loadPayouts(); }
  toggleAutoReload() { this.autoReload.update(v => !v); }

  // ── Tab switching ─────────────────────────────────────────────
  setTab(tab: 'vendors' | 'delivery') {
    this.activeTab.set(tab);
    this.page.set(1);
    this.resetForm();
    this.loadPayouts();
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.loadPayouts();
  }

  // ── Data loaders ──────────────────────────────────────────────
  loadVendors() {
    this.vendorsLoading.set(true);
    this.api.getAdminVendors({ page_size: 200 }).subscribe({
      next: (res: any) => { this.vendors.set(res.results || res); this.vendorsLoading.set(false); },
      error: () => this.vendorsLoading.set(false)
    });
  }

  loadPartners() {
    this.partnersLoading.set(true);
    this.api.getAdminDeliveryPartners({ page_size: 200 }).subscribe({
      next: (res: any) => { this.partners.set(res.results || res); this.partnersLoading.set(false); },
      error: () => this.partnersLoading.set(false)
    });
  }

  loadPayouts() {
    this.loading.set(true);
    const req = this.activeTab() === 'vendors'
      ? this.api.getAdminVendorPayouts({ page: this.page() })
      : this.api.getAdminDeliveryPayouts({ page: this.page() });

    req.subscribe({
      next: (res: any) => {
        const list = (res.results || res).map((p: any) => ({
          ...p,
          vendor_name: p.vendor_name || p.vendor || '—',
          partner_name: p.partner_name || p.delivery_partner || '—'
        }));
        this.payouts.set(list);
        this.totalItems.set(res.count ?? list.length);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => {
        this.toast.show(`Failed to load ${this.activeTab()} payouts.`, 'error');
        this.loading.set(false);
      }
    });
  }

  onVendorChange(event: Event) {
    const vendorId = (event.target as HTMLSelectElement).value;
    const vendor = this.vendors().find((v: any) => v.id === vendorId);
    this.selectedVendor.set(vendor || null);
    this.vendorBank.set(null);
    this.vendorSalesSummary.set(null);
    if (!vendorId) return;

    this.bankLoading.set(true);
    this.api.getVendorBankDetails(vendorId).subscribe({
      next: (bank: any) => { this.vendorBank.set(bank); this.bankLoading.set(false); },
      error: () => { this.bankLoading.set(false); }
    });

    // Auto-calculate if dates are already filled
    if (this.createFormObj.period_start && this.createFormObj.period_end) {
      this.calculateVendorSales();
    }
  }

  recalculate() {
    if (this.activeTab() === 'delivery') {
      this.calculateDeliveryEarnings();
    } else {
      this.calculateVendorSales();
    }
  }

  calculateVendorSales() {
    const vendorId = this.createFormObj.vendor_id;
    const start = this.createFormObj.period_start;
    const end = this.createFormObj.period_end;
    if (!vendorId || !start || !end) return;

    this.loadingSales.set(true);
    this.vendorSalesSummary.set(null);
    this.api.getAdminVendorSalesSummary(vendorId, start, end).subscribe({
      next: (res: any) => {
        this.vendorSalesSummary.set(res);
        // Auto-fill with gross sales (revenue from non-cancelled orders)
        this.createFormObj.amount = res.total_revenue;
        this.loadingSales.set(false);
      },
      error: () => {
        this.toast.show('Failed to fetch sales data for this period.', 'error');
        this.loadingSales.set(false);
      }
    });
  }

  calculateDeliveryEarnings() {
    const dpId = this.createFormObj.delivery_partner_id;
    const start = this.createFormObj.period_start;
    const end = this.createFormObj.period_end;
    if (!dpId || !start || !end) return;

    this.calculatingDeliveryEarnings.set(true);
    this.api.getAdminDeliveryPartnerEarnings(dpId, start, end).subscribe({
      next: (res: any) => {
        this.createFormObj.amount = res.total_amount;
        this.deliveryDeliveriesCount.set(res.total_deliveries);
        this.calculatingDeliveryEarnings.set(false);
      },
      error: () => {
        this.toast.show('Failed to calculate delivery earnings.', 'error');
        this.calculatingDeliveryEarnings.set(false);
      }
    });
  }

  // ── Modal controls ────────────────────────────────────────────
  openModal() {
    this.resetForm();
    this.showModal.set(true);
  }

  editPayout(payout: any) {
    this.resetForm();
    this.isEditMode.set(true);
    this.editingId.set(payout.id);

    const pStart = payout.period_start ? payout.period_start.split('T')[0] : '';
    const pEnd   = payout.period_end   ? payout.period_end.split('T')[0]   : '';

    if (this.activeTab() === 'vendors') {
      this.createFormObj.vendor_id = payout.vendor;
      this.createFormObj.amount    = payout.gross_sales;
    } else {
      const partnerObj = this.partners().find((p: any) =>
        p.user?.id === payout.delivery_partner || p.id === payout.delivery_partner
      );
      this.createFormObj.delivery_partner_id = partnerObj ? partnerObj.id : payout.delivery_partner;
      this.createFormObj.amount              = payout.total_earnings;
      this.deliveryDeliveriesCount.set(payout.total_deliveries || 0);
    }
    this.createFormObj.period_start = pStart;
    this.createFormObj.period_end   = pEnd;

    if (this.activeTab() === 'vendors' && this.createFormObj.vendor_id) {
      this.onVendorChange({ target: { value: this.createFormObj.vendor_id } } as any);
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.resetForm();
  }

  resetForm() {
    this.createFormObj = { vendor_id: '', delivery_partner_id: '', amount: null, period_start: '', period_end: '' };
    this.selectedVendor.set(null);
    this.vendorBank.set(null);
    this.vendorSalesSummary.set(null);
    this.isEditMode.set(false);
    this.editingId.set(null);
  }

  // ── Create / update submit ────────────────────────────────────
  submitPayout() {
    const isVendor = this.activeTab() === 'vendors';
    if (isVendor && !this.createFormObj.vendor_id) {
      this.toast.show('Please select a vendor.', 'error'); return;
    }
    if (!isVendor && !this.createFormObj.delivery_partner_id) {
      this.toast.show('Please select a delivery partner.', 'error'); return;
    }
    if (!this.createFormObj.amount || !this.createFormObj.period_start || !this.createFormObj.period_end) {
      this.toast.show('Please fill in all required fields.', 'error'); return;
    }

    this.creating.set(true);
    const payload: any = {
      period_start: this.createFormObj.period_start,
      period_end:   this.createFormObj.period_end,
      status: 'pending_approval'
    };

    if (isVendor) {
      const gross      = this.createFormObj.amount!;
      const commission = this.commissionAmt();
      const net        = this.netPayout();
      payload.vendor              = this.createFormObj.vendor_id;
      payload.gross_sales         = gross;
      payload.platform_commission = parseFloat(commission.toFixed(2));
      payload.net_payout          = parseFloat(net.toFixed(2));
    } else {
      const selected = this.partners().find((p: any) => p.id === this.createFormObj.delivery_partner_id);
      payload.delivery_partner = selected?.user?.id || this.createFormObj.delivery_partner_id;
      payload.total_deliveries = this.deliveryDeliveriesCount() > 0 ? this.deliveryDeliveriesCount() : 1;
      payload.total_earnings   = this.createFormObj.amount;
    }

    let req;
    if (this.isEditMode() && this.editingId()) {
      req = isVendor
        ? this.api.updateAdminVendorPayout(this.editingId()!, payload)
        : this.api.updateAdminDeliveryPayout(this.editingId()!, payload);
    } else {
      req = isVendor
        ? this.api.createAdminVendorPayout(payload)
        : this.api.createAdminDeliveryPayout(payload);
    }

    req.subscribe({
      next: () => {
        const isVendor = this.activeTab() === 'vendors';
        this.toast.show(
          this.isEditMode()
            ? 'Payout updated.'
            : isVendor
              ? 'Payout created — vendor notified for approval.'
              : 'Payout created — partner notified.',
          'success'
        );
        this.creating.set(false);
        this.closeModal();
        this.loadPayouts();
      },
      error: (err: any) => {
        const msg = err.error && typeof err.error === 'object'
          ? Object.values(err.error).flat().join(' ')
          : this.isEditMode() ? 'Failed to update payout.' : 'Failed to create payout.';
        this.toast.show(msg, 'error');
        this.creating.set(false);
      }
    });
  }

  // ── Lifecycle action helpers ──────────────────────────────────

  getPayoutAction(payout: any): 'schedule' | 'send-payment' | 'awaiting' | 'force-paid' | 'none' {
    const isDelivery = this.activeTab() === 'delivery';
    switch (payout.status) {
      case 'pending_approval': return isDelivery ? 'schedule' : 'none';
      case 'approved':         return 'schedule';
      case 'scheduled':        return 'send-payment';
      case 'paid':             return this.canForceVerify(payout) ? 'force-paid' : 'awaiting';
      default:                 return 'none';
    }
  }

  canForceVerify(payout: any): boolean {
    if (payout.status !== 'paid' || !payout.payment_sent_at) return false;
    const sentAt = new Date(payout.payment_sent_at).getTime();
    return (Date.now() - sentAt) >= 2 * 24 * 60 * 60 * 1000;
  }


  overrideAvailableAt(payout: any): Date | null {
    if (!payout.payment_sent_at) return null;
    const d = new Date(payout.payment_sent_at);
    d.setDate(d.getDate() + 2);
    return d;
  }

  schedulePayout(payout: any) {
    const isVendor = this.activeTab() === 'vendors';
    const req = isVendor
      ? this.api.scheduleAdminVendorPayout(payout.id)
      : this.api.scheduleAdminDeliveryPayout(payout.id);
    req.subscribe({
      next: () => { this.toast.show('Payout scheduled.', 'success'); this.loadPayouts(); },
      error: (e: any) => this.toast.show(e.error?.error || 'Failed to schedule.', 'error')
    });
  }

  openSendPaymentModal(payout: any) {
    this.sendingPaymentPayout.set(payout);
    this.transactionRefInput = '';
    this.showSendModal.set(true);
  }

  closeSendModal() {
    this.showSendModal.set(false);
    this.sendingPaymentPayout.set(null);
    this.transactionRefInput = '';
  }

  confirmSendPayment() {
    const payout = this.sendingPaymentPayout();
    if (!payout) return;
    this.sendingPayment.set(true);
    const isVendor = this.activeTab() === 'vendors';
    const req = isVendor
      ? this.api.sendAdminVendorPayment(payout.id, this.transactionRefInput)
      : this.api.sendAdminDeliveryPayment(payout.id, this.transactionRefInput);
    req.subscribe({
      next: () => {
        this.toast.show('Payment dispatched — vendor/partner notified to verify.', 'success');
        this.sendingPayment.set(false);
        this.closeSendModal();
        this.loadPayouts();
      },
      error: (e: any) => {
        this.toast.show(e.error?.error || 'Failed to send payment.', 'error');
        this.sendingPayment.set(false);
      }
    });
  }

  openForcePaidModal(payout: any) {
    this.forcePaidPayout.set(payout);
    this.showForcePaidModal.set(true);
  }

  closeForcePaidModal() {
    this.showForcePaidModal.set(false);
    this.forcePaidPayout.set(null);
  }

  confirmForcePaid() {
    const payout = this.forcePaidPayout();
    if (!payout) return;
    this.forcingPaid.set(true);
    const isVendor = this.activeTab() === 'vendors';
    const req = isVendor
      ? this.api.forceAdminVendorPayoutPaid(payout.id)
      : this.api.forceAdminDeliveryPayoutPaid(payout.id);
    req.subscribe({
      next: () => {
        this.toast.show('Payout marked as paid.', 'success');
        this.forcingPaid.set(false);
        this.closeForcePaidModal();
        this.loadPayouts();
      },
      error: (e: any) => {
        this.toast.show(e.error?.error || 'Override failed.', 'error');
        this.forcingPaid.set(false);
      }
    });
  }

  // ── Invoice helpers ───────────────────────────────────────────
  viewInvoice(payout: any) {
    this.invoicePayout.set(payout);
    this.invoiceBank.set(null);
    this.today = new Date();
    const vendorId = payout.vendor;
    if (vendorId) {
      this.api.getVendorBankDetails(vendorId).subscribe({
        next: (bank: any) => this.invoiceBank.set(bank),
        error: () => {}
      });
    }
  }

  closeInvoice() {
    this.invoicePayout.set(null);
    this.invoiceBank.set(null);
  }

  printInvoice() {
    window.print();
  }
}


