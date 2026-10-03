import { AdminRowActionsComponent } from '../../shared/admin-row-actions.component';
import { AdminDialogDirective } from '../../shared/admin-dialog.directive';
import { toLocalDateTimeInput } from '../../shared/admin-date-input';
import { AdminAccessService } from '../../services/admin-access.service';
import { AdminCanDirective } from '../../shared/admin-can.directive';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Subscription, timer } from 'rxjs';
import {
  CommonModule,
  DatePipe,
  DecimalPipe,
  TitleCasePipe,
} from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  apiErrorMessage,
  ApiService,
  AppCurrencyPipe,
  ToastService,
} from '@shared/public-api';
import { DynamicTableColumn, DynamicTableComponent, TableCellDirective } from '@shared/public-api';

@Component({
  selector: 'app-payouts',
  standalone: true,
  imports: [AdminDialogDirective, AdminRowActionsComponent,
    AdminCanDirective,
    CommonModule,
    FormsModule,
    AppCurrencyPipe,
    DecimalPipe,
    TitleCasePipe,
    DatePipe,
    DynamicTableComponent,
    TableCellDirective,
  ],
  templateUrl: './payouts.component.html',
  styleUrl: './payouts.component.scss',
})
export class PayoutsComponent implements OnInit, OnDestroy {
  readonly access = inject(AdminAccessService);
  vendorFilter = '';
  partnerFilter = '';
  private api = inject(ApiService);
  private toast = inject(ToastService);

  // ── Tabs & lists ─────────────────────────────────────────────
  activeTab = signal<'vendors' | 'delivery'>('vendors');
  loading = signal(false);
  payouts = signal<any[]>([]);
  totalItems = signal(0);
  page = signal(1);

  get tableColumns(): DynamicTableColumn[] {
    if (this.activeTab() === 'vendors') {
      return [
        { key: 'id', label: 'ID', flex: '0.5fr', minWidth: 72 },
        { key: 'entity', label: 'Vendor', flex: '1.5fr', minWidth: 140 },
        { key: 'period', label: 'Period', flex: '1.5fr', minWidth: 160 },
        { key: 'gross', label: 'Gross Sales', flex: '1fr', minWidth: 120, align: 'right' },
        { key: 'commission', label: 'Commission', flex: '1fr', minWidth: 110, align: 'right' },
        { key: 'net', label: 'Net Payout', flex: '1fr', minWidth: 120, align: 'right' },
        { key: 'status', label: 'Status', flex: '1fr', minWidth: 140 },
        { key: 'actions', label: 'Actions', flex: '0.6fr', minWidth: 100 },
      ];
    } else {
      return [
        { key: 'id', label: 'ID', flex: '0.5fr' },
        { key: 'entity', label: 'Partner', flex: '1.5fr', minWidth: 160 },
        { key: 'period', label: 'Period', flex: '1.5fr', minWidth: 180 },
        { key: 'net', label: 'Net Payout', flex: '1fr', minWidth: 140, align: 'right' },
        { key: 'status', label: 'Status', flex: '1fr', minWidth: 140 },
        { key: 'actions', label: 'Actions', flex: '0.6fr', minWidth: 100 },
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
  private readonly editingCommission = signal<{ gross: number; commission: number } | null>(null);

  createFormObj = {
    vendor_id: '',
    delivery_partner_id: '',
    amount: null as number | null,
    period_start: '',
    period_end: '',
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
    const existing = this.editingCommission();
    if (this.isEditMode() && existing) {
      return existing.gross > 0 ? existing.commission / existing.gross * 100 : 0;
    }
    const bank = this.vendorBank();
    return bank ? parseFloat(bank.commission_percentage) : 0;
  });

  commissionAmt = () => {
    const gross = this.createFormObj.amount ?? 0;
    return Number(((gross * this.commissionPct()) / 100).toFixed(2));
  };

  netPayout = () => {
    const gross = this.createFormObj.amount ?? 0;
    return Number((gross - this.commissionAmt()).toFixed(2));
  };

  // ── Invoice state ─────────────────────────────────────────────
  invoicePayout = signal<any | null>(null);
  invoiceBank = signal<any | null>(null);
  downloadingStatement = signal(false);
  invoiceBankError = signal('');
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
  overrideReason = '';

  // ── Delivery earnings helpers ─────────────────────────────────
  calculatingDeliveryEarnings = signal(false);
  deliveryDeliveriesCount = signal(0);

  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;
  private estimateSub?: Subscription;
  private bankSub?: Subscription;

  ngOnInit() {
    this.loadRecipients();
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (
        this.autoReload() &&
          !document.hidden &&
        !this.showModal() &&
        !this.showSendModal() &&
        !this.showForcePaidModal()
      ) {
        this.loadPayouts(this.lastRefreshed() !== null);
      }
    });
  }

  ngOnDestroy() {
    this.reloadSub?.unsubscribe();
    this.estimateSub?.unsubscribe();
    this.bankSub?.unsubscribe();
  }

  manualReload() {
    this.loadPayouts();
  }
  toggleAutoReload() {
    this.autoReload.update((v) => !v);
  }

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
  loadRecipients() {
    this.vendorsLoading.set(true);
    this.partnersLoading.set(true);
    this.api.getAdminFinanceRecipients().subscribe({
      next: (res: any) => {
        this.vendors.set(res.vendors);
        this.partners.set(res.delivery);
        this.vendorsLoading.set(false);
        this.partnersLoading.set(false);
      },
      error: error => {
        this.vendorsLoading.set(false);
        this.partnersLoading.set(false);
        this.toast.show(apiErrorMessage(error, 'Payout recipients could not be loaded. Refresh to retry.'), 'error');
      },
    });
  }

  loadPayouts(background = false) {
    if (!background) this.loading.set(true);
    const req =
      this.activeTab() === 'vendors'
        ? this.api.getAdminVendorPayouts({
            page: this.page(),
            ...(this.vendorFilter ? { vendor: this.vendorFilter } : {}),
          }, background)
        : this.api.getAdminDeliveryPayouts({
            page: this.page(),
            ...(this.partnerFilter ? { partner: this.partnerFilter } : {}),
          }, background);

    req.subscribe({
      next: (res: any) => {
        const list = (res.results || res).map((p: any) => ({
          ...p,
          vendor_name: p.vendor_name || p.vendor || '—',
          partner_name: p.partner_name || p.delivery_partner || '—',
        }));
        this.payouts.set(list);
        this.totalItems.set(res.count ?? list.length);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => {
        this.toast.show(`Failed to load ${this.activeTab()} payouts.`, 'error');
        this.loading.set(false);
      },
    });
  }

  onVendorChange(event: Event) {
    this.bankSub?.unsubscribe();
    const vendorId = (event.target as HTMLSelectElement).value;
    const vendor = this.vendors().find((v: any) => v.id === vendorId);
    this.selectedVendor.set(vendor || null);
    this.vendorBank.set(null);
    this.vendorSalesSummary.set(null);
    if (!vendorId) return;

    this.bankLoading.set(true);
    this.bankSub = this.api.getVendorBankDetails(vendorId).subscribe({
      next: (bank: any) => {
        this.vendorBank.set(bank);
        this.bankLoading.set(false);
      },
      error: () => {
        this.bankLoading.set(false);
      },
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
    this.estimateSub?.unsubscribe();
    this.loadingSales.set(false);
    const vendorId = this.createFormObj.vendor_id;
    const start = this.createFormObj.period_start;
    const end = this.createFormObj.period_end;
    if (!vendorId || !start || !end) return;

    this.loadingSales.set(true);
    this.vendorSalesSummary.set(null);
    this.estimateSub = this.api.getAdminPayoutEstimate('vendors', vendorId, start, end).subscribe({
      next: (res: any) => {
        this.vendorSalesSummary.set(res);
        // Estimate uses completed orders with verified receipts for this period.
        if (!this.isEditMode()) this.createFormObj.amount = res.total_revenue;
        this.loadingSales.set(false);
      },
      error: () => {
        this.toast.show('Failed to fetch sales data for this period.', 'error');
        this.loadingSales.set(false);
      },
    });
  }

  calculateDeliveryEarnings() {
    this.estimateSub?.unsubscribe();
    this.calculatingDeliveryEarnings.set(false);
    const dpId = this.createFormObj.delivery_partner_id;
    const start = this.createFormObj.period_start;
    const end = this.createFormObj.period_end;
    if (!dpId || !start || !end) return;

    this.calculatingDeliveryEarnings.set(true);
    this.estimateSub = this.api.getAdminPayoutEstimate('delivery', dpId, start, end).subscribe({
      next: (res: any) => {
        if (!this.isEditMode()) this.createFormObj.amount = res.total_amount;
        this.deliveryDeliveriesCount.set(res.total_deliveries);
        this.calculatingDeliveryEarnings.set(false);
      },
      error: () => {
        this.toast.show('Failed to calculate delivery earnings.', 'error');
        this.calculatingDeliveryEarnings.set(false);
      },
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

    const pStart = toLocalDateTimeInput(payout.period_start).slice(0, 10);
    const pEnd = toLocalDateTimeInput(payout.period_end).slice(0, 10);

    if (this.activeTab() === 'vendors') {
      this.editingCommission.set({ gross: Number(payout.gross_sales), commission: Number(payout.platform_commission) });
      this.createFormObj.vendor_id = payout.vendor;
      this.createFormObj.amount = payout.gross_sales;
    } else {
      const partnerObj = this.partners().find(
        (p: any) =>
          p.user?.id === payout.delivery_partner ||
          p.id === payout.delivery_partner
      );
      this.createFormObj.delivery_partner_id = partnerObj
        ? partnerObj.id
        : payout.delivery_partner;
      this.createFormObj.amount = payout.total_earnings;
      this.deliveryDeliveriesCount.set(payout.total_deliveries || 0);
    }
    this.createFormObj.period_start = pStart;
    this.createFormObj.period_end = pEnd;

    if (this.activeTab() === 'vendors' && this.createFormObj.vendor_id) {
      this.onVendorChange({
        target: { value: this.createFormObj.vendor_id },
      } as any);
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.resetForm();
  }

  resetForm() {
    this.estimateSub?.unsubscribe();
    this.bankSub?.unsubscribe();
    this.loadingSales.set(false);
    this.calculatingDeliveryEarnings.set(false);
    this.bankLoading.set(false);
    this.createFormObj = {
      vendor_id: '',
      delivery_partner_id: '',
      amount: null,
      period_start: '',
      period_end: '',
    };
    this.selectedVendor.set(null);
    this.vendorBank.set(null);
    this.vendorSalesSummary.set(null);
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.editingCommission.set(null);
  }

  // ── Create / update submit ────────────────────────────────────
  submitPayout() {
    if (this.creating() || this.bankLoading() || this.loadingSales() || this.calculatingDeliveryEarnings()) return;
    const isVendor = this.activeTab() === 'vendors';
    if (isVendor && !this.createFormObj.vendor_id) {
      this.toast.show('Please select a vendor.', 'error');
      return;
    }
    if (!isVendor && !this.createFormObj.delivery_partner_id) {
      this.toast.show('Please select a delivery partner.', 'error');
      return;
    }
    if (
      !Number.isFinite(Number(this.createFormObj.amount)) || Number(this.createFormObj.amount) <= 0 ||
      !this.createFormObj.period_start ||
      !this.createFormObj.period_end
    ) {
      this.toast.show('Please fill in all required fields.', 'error');
      return;
    }
    if (this.createFormObj.period_start > this.createFormObj.period_end) {
      this.toast.show('End date must follow the start date.', 'error');
      return;
    }

    this.creating.set(true);
    const payload: any = {
      period_start: new Date(`${this.createFormObj.period_start}T00:00:00`).toISOString(),
      period_end: new Date(`${this.createFormObj.period_end}T23:59:59`).toISOString(),
      status: 'pending_approval',
    };

    if (isVendor) {
      const gross = this.createFormObj.amount!;
      const commission = this.commissionAmt();
      const net = this.netPayout();
      payload.vendor = this.createFormObj.vendor_id;
      payload.gross_sales = gross;
      payload.platform_commission = parseFloat(commission.toFixed(2));
      payload.net_payout = parseFloat(net.toFixed(2));
    } else {
      const selected = this.partners().find(
        (p: any) => p.id === this.createFormObj.delivery_partner_id
      );
      payload.delivery_partner =
        selected?.user?.id || this.createFormObj.delivery_partner_id;
      payload.total_deliveries =
        this.deliveryDeliveriesCount();
      payload.total_earnings = this.createFormObj.amount;
    }

    let req;
    if (this.isEditMode() && this.editingId()) {
      delete payload.status;
      delete payload.vendor;
      delete payload.delivery_partner;
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
        const msg =
          err.error && typeof err.error === 'object'
            ? Object.values(err.error).flat().join(' ')
            : this.isEditMode()
            ? 'Failed to update payout.'
            : 'Failed to create payout.';
        this.toast.show(msg, 'error');
        this.creating.set(false);
      },
    });
  }

  // ── Lifecycle action helpers ──────────────────────────────────

  getPayoutAction(
    payout: any
  ): 'schedule' | 'send-payment' | 'awaiting' | 'force-paid' | 'none' {
    switch (payout.status) {
      case 'pending_approval':
        return 'none';
      case 'approved':
        return 'schedule';
      case 'scheduled':
        return 'send-payment';
      case 'paid':
        return this.canForceVerify(payout) ? 'force-paid' : 'awaiting';
      default:
        return 'none';
    }
  }

  canForceVerify(payout: any): boolean {
    if (payout.status !== 'paid' || !payout.payment_sent_at) return false;
    const sentAt = new Date(payout.payment_sent_at).getTime();
    return Date.now() - sentAt >= 2 * 24 * 60 * 60 * 1000;
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
      next: () => {
        this.toast.show('Payout scheduled.', 'success');
        this.loadPayouts();
      },
      error: (e: any) =>
        this.toast.show(apiErrorMessage(e, 'Failed to schedule.'), 'error'),
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
    if (!payout || this.sendingPayment() || !this.transactionRefInput.trim()) return;
    this.sendingPayment.set(true);
    const isVendor = this.activeTab() === 'vendors';
    const req = isVendor
      ? this.api.sendAdminVendorPayment(payout.id, this.transactionRefInput)
      : this.api.sendAdminDeliveryPayment(payout.id, this.transactionRefInput);
    req.subscribe({
      next: () => {
        this.toast.show(
            'External payment reference recorded. No money was transferred by this app.',
          'success'
        );
        this.sendingPayment.set(false);
        this.closeSendModal();
        this.loadPayouts();
      },
      error: (e: any) => {
        this.toast.show(apiErrorMessage(e, 'Failed to send payment.'), 'error');
        this.sendingPayment.set(false);
      },
    });
  }

  openForcePaidModal(payout: any) {
    this.overrideReason = '';
    this.forcePaidPayout.set(payout);
    this.showForcePaidModal.set(true);
  }

  closeForcePaidModal() {
    this.showForcePaidModal.set(false);
    this.forcePaidPayout.set(null);
  }

  confirmForcePaid() {
    const payout = this.forcePaidPayout();
    if (!payout || this.forcingPaid() || !this.overrideReason.trim()) return;
    this.forcingPaid.set(true);
    const isVendor = this.activeTab() === 'vendors';
    const req = isVendor
      ? this.api.forceAdminVendorPayoutPaid(payout.id, this.overrideReason)
      : this.api.forceAdminDeliveryPayoutPaid(payout.id, this.overrideReason);
    req.subscribe({
      next: () => {
          this.toast.show('Recipient verification overridden with an audit reason.', 'success');
        this.forcingPaid.set(false);
        this.closeForcePaidModal();
        this.loadPayouts();
      },
      error: (e: any) => {
        this.toast.show(apiErrorMessage(e, 'Override failed.'), 'error');
        this.forcingPaid.set(false);
      },
    });
  }

  // ── Invoice helpers ───────────────────────────────────────────
  viewInvoice(payout: any) {
    this.invoicePayout.set(payout);
    this.invoiceBank.set(null);
    this.invoiceBankError.set('');
    this.today = new Date();
    const vendorId = payout.vendor;
    if (vendorId) {
      this.api.getVendorBankDetails(vendorId).subscribe({
        next: (bank: any) => this.invoiceBank.set(bank.configured ? bank : null),
        error: () => this.invoiceBankError.set('Bank details could not be loaded. The statement still shows the stored payout amounts.'),
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

  downloadStatement() {
    const payout = this.invoicePayout();
    if (!payout || this.downloadingStatement()) return;
    this.downloadingStatement.set(true);
    this.api.downloadAdminPayoutStatement(this.activeTab(), payout.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `settlement-${payout.id}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloadingStatement.set(false);
      },
      error: error => {
        this.toast.show(apiErrorMessage(error, 'Statement download failed. Please retry.'), 'error');
        this.downloadingStatement.set(false);
      },
    });
  }
}
