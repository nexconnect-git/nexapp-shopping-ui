import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, AppCurrencyPipe, ToastService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';
import {
  AdminProfileBadge,
  AdminProfileMetric,
  AdminProfileShellComponent,
  AdminProfileTab,
} from '../../shared/components/admin-profile-shell/admin-profile-shell.component';
import { DynamicProfilePageComponent } from '../../shared/dynamic-profile/dynamic-profile-page.component';
import { EntityProfileAdapterService } from '../../shared/dynamic-profile/entity-profile-adapter.service';
import { ProfileHeroAction } from '../../shared/dynamic-profile/dynamic-profile.models';

type Tab = 'overview' | 'orders' | 'loyalty';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [DynamicProfilePageComponent],
  templateUrl: './customer-profile.component.html',
  styleUrl: './customer-profile.component.scss',
})
export class CustomerProfileComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private adapter = inject(EntityProfileAdapterService);

  customerId = '';
  customer = signal<any>(null);
  loading = signal(true);
  actionLoading = signal(false);
  dynamicProfileConfig = computed(() =>
    this.customer()
      ? this.adapter.buildProfileConfig('customer', this.customer())
      : null,
  );

  activeTab = signal<Tab>('overview');

  profileTabs: AdminProfileTab[] = [
    { id: 'overview', label: 'Overview', icon: 'person' },
    { id: 'orders', label: 'Orders', icon: 'receipt_long' },
    { id: 'loyalty', label: 'Loyalty Points', icon: 'stars' },
  ];

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
      next: (c) => {
        this.customer.set(c);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/customers']);
      },
    });
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'orders' && !this.ordersLoaded) this.loadOrders();
    if (tab === 'loyalty' && !this.loyaltyLoaded) this.loadLoyalty();
  }

  setProfileTab(tab: string) {
    this.setTab(tab as Tab);
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
      error: () => this.ordersLoading.set(false),
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
      error: () => this.loyaltyLoading.set(false),
    });
  }

  openAdjustModal() {
    this.adjustOp = 'credit';
    this.adjustAmount = 0;
    this.adjustReason = '';
    this.adjustError.set('');
    this.showAdjustModal.set(true);
  }

  closeAdjustModal() {
    this.showAdjustModal.set(false);
  }

  submitAdjust() {
    if (!this.adjustAmount || this.adjustAmount <= 0) {
      this.adjustError.set('Amount must be positive.');
      return;
    }
    if (!this.adjustReason.trim()) {
      this.adjustError.set('Reason is required.');
      return;
    }
    this.adjusting.set(true);
    this.adjustError.set('');
    this.api
      .adjustAdminCustomerLoyalty(this.customerId, {
        operation: this.adjustOp,
        amount: this.adjustAmount,
        reason: this.adjustReason.trim(),
      })
      .subscribe({
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
        },
      });
  }

  changeOrdersFilter() {
    this.ordersPage.set(1);
    this.loadOrders();
  }
  changeOrdersPage(p: number) {
    this.ordersPage.set(p);
    this.loadOrders();
  }

  openEdit() {
    const c = this.customer();
    this.editForm = {
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      is_verified: c.is_verified,
      is_active: c.is_active !== false,
    };
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEdit() {
    this.showEditModal.set(false);
  }

  saveEdit() {
    this.editSaving.set(true);
    this.editError.set('');
    this.api.updateAdminCustomer(this.customerId, this.editForm).subscribe({
      next: () => {
        this.loadCustomer();
        this.editSaving.set(false);
        this.closeEdit();
      },
      error: (err) => {
        this.editSaving.set(false);
        this.editError.set(err.error?.detail || 'Update failed.');
      },
    });
  }

  quickSetStatus(event: Event) {
    const isActive = (event.target as HTMLSelectElement).value === 'true';
    this.actionLoading.set(true);
    this.api
      .updateAdminCustomer(this.customerId, { is_active: isActive })
      .subscribe({
        next: () => {
          this.loadCustomer();
          this.toast.show(
            `Account ${isActive ? 'activated' : 'suspended'}.`,
            isActive ? 'success' : 'info',
          );
          this.actionLoading.set(false);
        },
        error: () => {
          this.toast.show('Failed to update status.', 'error');
          this.actionLoading.set(false);
        },
      });
  }

  deleteCustomer() {
    if (
      !confirm(
        `Delete customer "${this.customer()?.username}"? This is permanent.`,
      )
    )
      return;
    this.api
      .deleteAdminCustomer(this.customerId)
      .subscribe({ next: () => this.router.navigate(['/customers']) });
  }

  handleDynamicAction(action: ProfileHeroAction) {
    if (action.id === 'edit') {
      this.router.navigate(['/customers', this.customerId, 'edit']);
      return;
    }
    if (action.id === 'review') {
      this.router.navigate(['/customers', this.customerId, 'review']);
      return;
    }
    if (action.id === 'resetPassword') {
      this.toast.show(
        'Password reset flow is available from auth support tools.',
        'info',
      );
    }
  }

  editDynamicSection() {
    this.router.navigate(['/customers', this.customerId, 'edit']);
  }

  txTypeLabel(type: string): string {
    const map: Record<string, string> = {
      earn: 'Earned',
      redeem: 'Redeemed',
      admin_credit: 'Admin Credit',
      admin_debit: 'Admin Debit',
      referral: 'Referral Bonus',
    };
    return map[type] || type;
  }

  txTypeClass(type: string): string {
    return type === 'earn' || type === 'admin_credit' || type === 'referral'
      ? 'tx-credit'
      : 'tx-debit';
  }

  avatarColor(name: string): string {
    const colors = [
      '#38268E',
      '#38268E',
      '#EF4444',
      '#EF4444',
      '#22C55E',
      '#EF4444',
      '#38268E',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  initials(c: any): string {
    return (
      ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase() ||
      c.username?.[0]?.toUpperCase() ||
      '?'
    );
  }

  customerBadges(): AdminProfileBadge[] {
    const c = this.customer();
    if (!c) return [];
    return [
      {
        label: c.is_verified ? 'Verified' : 'Unverified',
        className: c.is_verified ? 'badge-approved' : 'badge-pending',
      },
      {
        label: c.is_active !== false ? 'Active' : 'Suspended',
        className: c.is_active !== false ? 'badge-approved' : 'badge-rejected',
      },
      { label: 'Customer', className: 'role-badge' },
    ];
  }

  customerMetrics(): AdminProfileMetric[] {
    const c = this.customer();
    if (!c) return [];
    return [
      {
        label: 'Account Health',
        value: c.is_active !== false && c.is_verified ? 'Clear' : 'Review',
        subtext:
          c.is_active === false
            ? 'Account suspended'
            : c.is_verified
              ? 'Verified customer'
              : 'Verification pending',
        icon: 'verified_user',
        priority: true,
      },
      {
        label: 'Orders',
        value: c.total_orders || c.orders_count || this.ordersTotal() || 0,
        subtext: 'Linked purchase history',
        icon: 'shopping_bag',
        tone: 'warm',
      },
      {
        label: 'Loyalty',
        value: this.loyaltyBalance(),
        subtext: 'Current points balance',
        icon: 'stars',
        tone: 'green',
      },
      {
        label: 'Contactability',
        value: c.email && c.phone ? 'Complete' : 'Partial',
        subtext: c.email || c.phone || 'No contact channel',
        icon: 'alternate_email',
        tone: 'slate',
      },
    ];
  }

  orderStatusBadge(s: string): string {
    const map: Record<string, string> = {
      delivered: 'badge-approved',
      placed: 'badge-pending',
      cancelled: 'badge-rejected',
      preparing: 'badge-warning',
      confirmed: 'badge-info',
      on_the_way: 'badge-info',
      picked_up: 'badge-info',
    };
    return map[s] || '';
  }
}

