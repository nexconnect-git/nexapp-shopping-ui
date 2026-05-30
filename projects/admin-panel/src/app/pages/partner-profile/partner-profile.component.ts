import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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

type Tab = 'overview' | 'deliveries' | 'assets';

@Component({
  selector: 'app-partner-profile',
  standalone: true,
  imports: [DynamicProfilePageComponent],
  templateUrl: './partner-profile.component.html',
  styleUrl: './partner-profile.component.scss',
})
export class PartnerProfileComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private adapter = inject(EntityProfileAdapterService);

  partnerId = '';
  partner = signal<any>(null);
  loading = signal(true);
  actionLoading = signal(false);
  dynamicProfileConfig = computed(() =>
    this.partner()
      ? this.adapter.buildProfileConfig('delivery-partner', this.partner())
      : null,
  );

  /** Derived status for the select: active | suspended | pending */
  partnerAccountStatus = computed(() => {
    const p = this.partner();
    if (!p) return 'pending';
    if (!p.is_approved) return 'pending';
    if (p.user?.is_active === false) return 'suspended';
    return 'active';
  });

  showTempPassword = signal(false);
  copied = signal(false);

  activeTab = signal<Tab>('overview');

  profileTabs: AdminProfileTab[] = [
    { id: 'overview', label: 'Overview', icon: 'person' },
    { id: 'deliveries', label: 'Deliveries', icon: 'local_shipping' },
    { id: 'assets', label: 'Assigned Assets', icon: 'handyman' },
  ];

  // Deliveries tab
  deliveries = signal<any[]>([]);
  deliveriesTotal = signal(0);
  deliveriesPage = signal(1);
  deliveriesLoading = signal(false);
  deliveriesStatusFilter = '';
  deliveriesLoaded = false;

  deliveryColumns = [
    { key: 'order_number', label: 'Order', flex: '1.5fr' },
    { key: 'customer', label: 'Customer', flex: '1.5fr' },
    { key: 'vendor', label: 'Vendor', flex: '1.5fr' },
    { key: 'total', label: 'Total', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'placed_at', label: 'Date', flex: '1.2fr' },
  ];

  // Assets tab
  assets = signal<any[]>([]);
  assetsLoading = signal(false);
  assetsLoaded = false;

  assetColumns = [
    { key: 'name', label: 'Asset', flex: '2fr' },
    { key: 'asset_type', label: 'Type', flex: '1fr' },
    { key: 'serial_number', label: 'Serial #', flex: '1.5fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
  ];

  ngOnInit() {
    this.partnerId = this.route.snapshot.paramMap.get('id')!;
    this.loadPartner();
  }

  loadPartner() {
    this.loading.set(true);
    this.api.getAdminDeliveryPartner(this.partnerId).subscribe({
      next: (p) => {
        this.partner.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/delivery-partners']);
      },
    });
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'deliveries' && !this.deliveriesLoaded) this.loadDeliveries();
    if (tab === 'assets' && !this.assetsLoaded) this.loadAssets();
  }

  setProfileTab(tab: string) {
    this.setTab(tab as Tab);
  }

  loadDeliveries() {
    this.deliveriesLoading.set(true);
    const params: any = {
      delivery_partner: this.partnerId,
      page: this.deliveriesPage(),
    };
    if (this.deliveriesStatusFilter)
      params.status = this.deliveriesStatusFilter;
    this.api.getAdminOrders(params).subscribe({
      next: (r) => {
        this.deliveries.set(r.results || r);
        this.deliveriesTotal.set(r.count || (r.results || r).length);
        this.deliveriesLoading.set(false);
        this.deliveriesLoaded = true;
      },
      error: () => this.deliveriesLoading.set(false),
    });
  }

  changeDeliveriesFilter() {
    this.deliveriesPage.set(1);
    this.loadDeliveries();
  }
  changeDeliveriesPage(p: number) {
    this.deliveriesPage.set(p);
    this.loadDeliveries();
  }

  loadAssets() {
    this.assetsLoading.set(true);
    this.api.getAssets({ assigned_to: this.partnerId }).subscribe({
      next: (r) => {
        this.assets.set(r.results || r);
        this.assetsLoading.set(false);
        this.assetsLoaded = true;
      },
      error: () => this.assetsLoading.set(false),
    });
  }

  approve() {
    this.actionLoading.set(true);
    this.api.approveDeliveryPartner(this.partnerId, 'approve').subscribe({
      next: () => {
        this.toast.show('Partner approved.', 'success');
        this.actionLoading.set(false);
        this.loadPartner();
      },
      error: () => {
        this.toast.show('Failed to approve.', 'error');
        this.actionLoading.set(false);
      },
    });
  }

  onAccountStatusChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (value === this.partnerAccountStatus()) return;
    if (!confirm(`Set partner account status to "${value}"?`)) {
      this.partner.update((p) => ({ ...p })); // reset select
      return;
    }
    this.actionLoading.set(true);

    if (value === 'active') {
      // Approve + set user active
      this.api.approveDeliveryPartner(this.partnerId, 'approve').subscribe({
        next: () =>
          this.api
            .updateAdminDeliveryPartner(this.partnerId, {
              user_is_active: true,
            })
            .subscribe({
              next: () => {
                this.toast.show('Partner activated.', 'success');
                this.actionLoading.set(false);
                this.loadPartner();
              },
              error: () => {
                this.toast.show('Failed to activate.', 'error');
                this.actionLoading.set(false);
              },
            }),
        error: () => {
          this.toast.show('Failed to approve.', 'error');
          this.actionLoading.set(false);
        },
      });
    } else if (value === 'suspended') {
      // Keep approved but suspend the user account
      this.api
        .updateAdminDeliveryPartner(this.partnerId, { user_is_active: false })
        .subscribe({
          next: () => {
            this.toast.show('Partner suspended.', 'info');
            this.actionLoading.set(false);
            this.loadPartner();
          },
          error: () => {
            this.toast.show('Failed to suspend.', 'error');
            this.actionLoading.set(false);
          },
        });
    } else {
      // pending = revoke approval
      this.api.approveDeliveryPartner(this.partnerId, 'reject').subscribe({
        next: () => {
          this.toast.show('Partner set to pending.', 'info');
          this.actionLoading.set(false);
          this.loadPartner();
        },
        error: () => {
          this.toast.show('Failed to update.', 'error');
          this.actionLoading.set(false);
        },
      });
    }
  }

  toggleTempPassword() {
    this.showTempPassword.update((v) => !v);
  }

  copyTempPassword() {
    const pwd = this.partner()?.user?.temp_password;
    if (!pwd) return;
    navigator.clipboard.writeText(pwd).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  revoke() {
    if (!confirm('Revoke approval for this partner?')) return;
    this.actionLoading.set(true);
    this.api.approveDeliveryPartner(this.partnerId, 'reject').subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.loadPartner();
      },
      error: () => this.actionLoading.set(false),
    });
  }

  avatarColor(name: string): string {
    const colors = [
      '#6C2BFF',
      '#6C2BFF',
      '#EF4444',
      '#EF4444',
      '#22C55E',
      '#EF4444',
      '#6C2BFF',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  handleDynamicAction(action: ProfileHeroAction) {
    if (action.id === 'edit') {
      this.router.navigate(['/delivery-partners', this.partnerId, 'edit']);
      return;
    }
    if (action.id === 'review') {
      this.router.navigate(['/delivery-partners', this.partnerId, 'review']);
      return;
    }
    if (action.id === 'approve') {
      this.approve();
      return;
    }
    if (action.id === 'resetPassword') {
      this.actionLoading.set(true);
      this.api
        .generateAdminDeliveryPartnerTemporaryPassword(this.partnerId)
        .subscribe({
          next: (partner) => {
            this.partner.set(partner);
            this.actionLoading.set(false);
            this.toast.show(
              'Temporary password generated. Share it securely with the partner.',
              'success',
            );
          },
          error: () => {
            this.actionLoading.set(false);
            this.toast.show('Failed to generate temporary password.', 'error');
          },
        });
    }
  }

  editDynamicSection(stepId: string) {
    this.router.navigate(['/delivery-partners', this.partnerId, 'edit'], {
      queryParams: { step: stepId },
    });
  }

  partnerBadges(): AdminProfileBadge[] {
    const p = this.partner();
    if (!p) return [];
    return [
      { label: p.status, className: this.statusBadge(p.status) },
      {
        label: p.is_approved ? 'Approved' : 'Pending',
        className: p.is_approved ? 'badge-approved' : 'badge-pending',
      },
    ];
  }

  partnerMetrics(): AdminProfileMetric[] {
    const p = this.partner();
    if (!p) return [];
    return [
      {
        label: 'Approval',
        value: p.is_approved ? 'Approved' : 'Pending',
        subtext: `${this.partnerAccountStatus()} account`,
        icon: 'badge',
        priority: true,
      },
      {
        label: 'Deliveries',
        value: p.total_deliveries || this.deliveriesTotal() || 0,
        subtext: 'Completed assignments',
        icon: 'local_shipping',
        tone: 'green',
      },
      {
        label: 'Rating',
        value: p.average_rating || '0.0',
        subtext: 'Customer score',
        icon: 'star',
        tone: 'warm',
      },
      {
        label: 'Vehicle',
        value: p.vehicle_type || 'Vehicle',
        subtext: p.vehicle_number || 'Plate missing',
        icon: 'two_wheeler',
        tone: 'slate',
      },
    ];
  }

  statusBadge(s: string): string {
    const map: Record<string, string> = {
      available: 'badge-approved',
      on_delivery: 'badge-info',
      offline: 'badge-pending',
    };
    return map[s] || '';
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

  assetStatusBadge(s: string): string {
    const map: Record<string, string> = {
      active: 'badge-approved',
      inactive: 'badge-pending',
      maintenance: 'badge-warning',
      retired: 'badge-rejected',
    };
    return map[s] || '';
  }

  starsFor(r: number) {
    const f = Math.round(r);
    return '★'.repeat(f) + '☆'.repeat(5 - f);
  }
}
