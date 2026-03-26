import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

type Tab = 'overview' | 'orders';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DynamicTableComponent, TableCellDirective, DecimalPipe],
  templateUrl: './customer-profile.component.html',
  styleUrl: './customer-profile.component.scss'
})
export class CustomerProfileComponent implements OnInit {
  private api = inject(ApiService);
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
      is_active: c.is_active !== false,
    };
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

  deleteCustomer() {
    if (!confirm(`Delete customer "${this.customer()?.username}"? This is permanent.`)) return;
    this.api.deleteAdminCustomer(this.customerId).subscribe({ next: () => this.router.navigate(['/customers']) });
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
