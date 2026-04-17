import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, ToastService, AppCurrencyPipe } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

type Tab = 'overview' | 'orders' | 'loyalty';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DynamicTableComponent, TableCellDirective, AppCurrencyPipe],
  templateUrl: './customer-profile.component.html',
  styleUrl: './customer-profile.component.scss'
})
export class CustomerProfileComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  customerId = '';
  customer = signal<any>(null);
  loading = signal(true);
  actionLoading = signal(false);

  activeTab = signal<Tab>('overview');

  // Orders tab
  orders = signal<any[]>([]);
  ordersTotal = signal(0);
  ordersPage = signal(1);
  ordersLoading = signal(false);
  ordersStatusFilter = '';
  ordersLoaded = false;

  orderColumns = [
    { key: 'order_number', label: 'Order', flex: '1.5fr' },
    { key: 'vendor', label: 'Vendor', flex: '1.5fr' },
    { key: 'total', label: 'Total', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'placed_at', label: 'Date', flex: '1.2fr' },
  ];

  // Loyalty tab
  loyaltyBalance = signal(0);
  loyaltyLifetime = signal(0);
  loyaltyTransactions = signal<any[]>([]);
  loyaltyLoading = signal(false);
  loyaltyLoaded = false;

  // Loyalty adjustment modal
  showAdjustModal = signal(false);
  adjustOp: 'credit' | 'debit' = 'credit';
  adjustAmount = 0;
  adjustReason = '';
  adjusting = signal(false);
  adjustError = signal('');

  // Edit modal
  showEditModal = signal(false);
  editForm: any = {};
  editError = signal('');
  editSaving = signal(false);

  ngOnInit() {
    this.customerId = this.route.snapshot.paramMap.get('id')!;
    this.loadCustomer();
  }

  loadCustomer() {
    this.loading.set(true);
    this.api.getAdminCustomer(this.customerId).subscribe({
      next: (c) => { this.customer.set(c); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/customers']); }
    });
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'orders' && !this.ordersLoaded) this.loadOrders();
    if (tab === 'loyalty' && !this.loyaltyLoaded) this.loadLoyalty();
  }

  loadOrders() {
    this.ordersLoading.set(true);
    const params: any = { customer: this.customerId, page: this.ordersPage() };
    if (this.ordersStatusFilter) params.status = this.ordersStatusFilter;
    this.api.getAdminOrders(params).subscribe({
      next: (r) => {
        this.orders.set(r.results || r);
        this.ordersTotal.set(r.count || (r.results || r).length);
        this.ordersLoading.set(false);
        this.ordersLoaded = true;
      },
      error: () => this.ordersLoading.set(false)
    });
  }

  loadLoyalty() {
    this.loyaltyLoading.set(true);
    this.api.getAdminCustomerLoyalty(this.customerId).subscribe({
      next: (data) => {
        this.loyaltyBalance.set(data.points);
        this.loyaltyLifetime.set(data.lifetime_points);
        this.loyaltyTransactions.set(data.transactions || []);
        this.loyaltyLoading.set(false);
        this.loyaltyLoaded = true;
      },
      error: () => this.loyaltyLoading.set(false)
    });
  }

  openAdjustModal() {
    this.adjustOp = 'credit';
    this.adjustAmount = 0;
    this.adjustReason = '';
    this.adjustError.set('');
    this.showAdjustModal.set(true);
  }

  closeAdjustModal() { this.showAdjustModal.set(false); }

  submitAdjust() {
    if (!this.adjustAmount || this.adjustAmount <= 0) { this.adjustError.set('Amount must be positive.'); return; }
    if (!this.adjustReason.trim()) { this.adjustError.set('Reason is required.'); return; }
    this.adjusting.set(true);
    this.adjustError.set('');
    this.api.adjustAdminCustomerLoyalty(this.customerId, {
      operation: this.adjustOp,
      amount: this.adjustAmount,
      reason: this.adjustReason.trim()
    }).subscribe({
      next: (res) => {
        this.loyaltyBalance.set(res.points);
        this.loyaltyLifetime.set(res.lifetime_points);
        this.loyaltyLoaded = false; // force reload transactions
        this.loadLoyalty();
        this.adjusting.set(false);
        this.closeAdjustModal();
        this.toast.show(res.message, 'success');
      },
      error: (err) => {
        this.adjustError.set(err.error?.error || 'Adjustment failed.');
        this.adjusting.set(false);
      }
    });
  }

  changeOrdersFilter() { this.ordersPage.set(1); this.loadOrders(); }
  changeOrdersPage(p: number) { this.ordersPage.set(p); this.loadOrders(); }

  openEdit() {
    const c = this.customer();
    this.editForm = {
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      is_verified: c.is_verified,
      is_active: c.is_active !== false };
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEdit() { this.showEditModal.set(false); }

  saveEdit() {
    this.editSaving.set(true);
    this.editError.set('');
    this.api.updateAdminCustomer(this.customerId, this.editForm).subscribe({
      next: (c) => { this.customer.set(c); this.editSaving.set(false); this.closeEdit(); },
      error: (err) => { this.editSaving.set(false); this.editError.set(err.error?.detail || 'Update failed.'); }
    });
  }

  quickSetStatus(event: Event) {
    const isActive = (event.target as HTMLSelectElement).value === 'true';
    this.actionLoading.set(true);
    this.api.updateAdminCustomer(this.customerId, { is_active: isActive }).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.toast.show(`Account ${isActive ? 'activated' : 'suspended'}.`, isActive ? 'success' : 'info');
        this.actionLoading.set(false);
      },
      error: () => { this.toast.show('Failed to update status.', 'error'); this.actionLoading.set(false); }
    });
  }

  deleteCustomer() {
    if (!confirm(`Delete customer "${this.customer()?.username}"? This is permanent.`)) return;
    this.api.deleteAdminCustomer(this.customerId).subscribe({ next: () => this.router.navigate(['/customers']) });
  }

  txTypeLabel(type: string): string {
    const map: Record<string, string> = {
      earn: 'Earned', redeem: 'Redeemed',
      admin_credit: 'Admin Credit', admin_debit: 'Admin Debit',
      referral: 'Referral Bonus',
    };
    return map[type] || type;
  }

  txTypeClass(type: string): string {
    return (type === 'earn' || type === 'admin_credit' || type === 'referral') ? 'tx-credit' : 'tx-debit';
  }

  avatarColor(name: string): string {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  initials(c: any): string {
    return ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase() || c.username?.[0]?.toUpperCase() || '?';
  }

  orderStatusBadge(s: string): string {
    const map: Record<string, string> = { delivered: 'badge-approved', placed: 'badge-pending', cancelled: 'badge-rejected', preparing: 'badge-warning', confirmed: 'badge-info', on_the_way: 'badge-info', picked_up: 'badge-info' };
    return map[s] || '';
  }
}
