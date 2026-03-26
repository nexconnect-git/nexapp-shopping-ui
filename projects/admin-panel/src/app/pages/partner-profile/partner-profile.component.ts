import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

type Tab = 'overview' | 'deliveries' | 'assets';

@Component({
  selector: 'app-partner-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DynamicTableComponent, TableCellDirective, DecimalPipe],
  templateUrl: './partner-profile.component.html',
  styleUrl: './partner-profile.component.scss'
})
export class PartnerProfileComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  partnerId = '';
  partner = signal<any>(null);
  loading = signal(true);
  actionLoading = signal(false);

  activeTab = signal<Tab>('overview');

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
      next: (p) => { this.partner.set(p); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/delivery-partners']); }
    });
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'deliveries' && !this.deliveriesLoaded) this.loadDeliveries();
    if (tab === 'assets' && !this.assetsLoaded) this.loadAssets();
  }

  loadDeliveries() {
    this.deliveriesLoading.set(true);
    const params: any = { delivery_partner: this.partnerId, page: this.deliveriesPage() };
    if (this.deliveriesStatusFilter) params.status = this.deliveriesStatusFilter;
    this.api.getAdminOrders(params).subscribe({
      next: (r) => {
        this.deliveries.set(r.results || r);
        this.deliveriesTotal.set(r.count || (r.results || r).length);
        this.deliveriesLoading.set(false);
        this.deliveriesLoaded = true;
      },
      error: () => this.deliveriesLoading.set(false)
    });
  }

  changeDeliveriesFilter() { this.deliveriesPage.set(1); this.loadDeliveries(); }
  changeDeliveriesPage(p: number) { this.deliveriesPage.set(p); this.loadDeliveries(); }

  loadAssets() {
    this.assetsLoading.set(true);
    this.api.getAssets({ assigned_to: this.partnerId }).subscribe({
      next: (r) => {
        this.assets.set(r.results || r);
        this.assetsLoading.set(false);
        this.assetsLoaded = true;
      },
      error: () => this.assetsLoading.set(false)
    });
  }

  approve() {
    this.actionLoading.set(true);
    this.api.approveDeliveryPartner(this.partnerId, 'approve').subscribe({
      next: () => { this.actionLoading.set(false); this.loadPartner(); },
      error: () => this.actionLoading.set(false)
    });
  }

  revoke() {
    if (!confirm('Revoke approval for this partner?')) return;
    this.actionLoading.set(true);
    this.api.approveDeliveryPartner(this.partnerId, 'reject').subscribe({
      next: () => { this.actionLoading.set(false); this.loadPartner(); },
      error: () => this.actionLoading.set(false)
    });
  }

  avatarColor(name: string): string {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  statusBadge(s: string): string {
    const map: Record<string, string> = { available: 'badge-approved', on_delivery: 'badge-info', offline: 'badge-pending' };
    return map[s] || '';
  }

  orderStatusBadge(s: string): string {
    const map: Record<string, string> = { delivered: 'badge-approved', placed: 'badge-pending', cancelled: 'badge-rejected', preparing: 'badge-warning', confirmed: 'badge-info', on_the_way: 'badge-info', picked_up: 'badge-info' };
    return map[s] || '';
  }

  assetStatusBadge(s: string): string {
    const map: Record<string, string> = { active: 'badge-approved', inactive: 'badge-pending', maintenance: 'badge-warning', retired: 'badge-rejected' };
    return map[s] || '';
  }

  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
