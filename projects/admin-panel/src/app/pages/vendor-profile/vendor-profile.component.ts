import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

type Tab = 'overview' | 'products' | 'orders' | 'report';
type Period = '30d' | '90d' | '12m';

@Component({
  selector: 'app-vendor-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DynamicTableComponent, TableCellDirective, DecimalPipe],
  templateUrl: './vendor-profile.component.html',
  styleUrl: './vendor-profile.component.scss'
})
export class VendorProfileComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  vendorId = '';
  vendor = signal<any>(null);
  loading = signal(true);
  actionLoading = signal(false);

  activeTab = signal<Tab>('overview');

  // Products tab
  products = signal<any[]>([]);
  productsTotal = signal(0);
  productsPage = signal(1);
  productsLoading = signal(false);
  productsLoaded = false;

  productColumns = [
    { key: 'name', label: 'Product', flex: '2fr' },
    { key: 'price', label: 'Price', flex: '1fr' },
    { key: 'stock', label: 'Stock', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
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
    { key: 'customer', label: 'Customer', flex: '1.5fr' },
    { key: 'total', label: 'Total', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'placed_at', label: 'Date', flex: '1.2fr' },
  ];

  // Sales report tab
  report = signal<any>(null);
  reportPeriod = signal<Period>('30d');
  reportLoading = signal(false);
  reportLoaded = false;

  logoUploading = signal(false);

  showTempPassword = signal(false);
  copied = signal(false);

  Math = Math;

  toggleTempPassword() {
    this.showTempPassword.update(v => !v);
  }

  copyTempPassword() {
    const pwd = this.vendor()?.user_info?.temp_password;
    if (!pwd) return;
    navigator.clipboard.writeText(pwd).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  ngOnInit() {
    this.vendorId = this.route.snapshot.paramMap.get('id')!;
    this.loadVendor();
  }

  loadVendor() {
    this.loading.set(true);
    this.api.getAdminVendor(this.vendorId).subscribe({
      next: (v) => { this.vendor.set(v); this.loading.set(false); },
      error: () => { this.loading.set(false); this.router.navigate(['/vendors']); }
    });
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'products' && !this.productsLoaded) this.loadProducts();
    if (tab === 'orders' && !this.ordersLoaded) this.loadOrders();
    if (tab === 'report' && !this.reportLoaded) this.loadReport();
  }

  loadProducts() {
    this.productsLoading.set(true);
    this.api.getAdminProducts({ vendor: this.vendorId, page: this.productsPage() }).subscribe({
      next: (r) => {
        this.products.set(r.results || r);
        this.productsTotal.set(r.count || (r.results || r).length);
        this.productsLoading.set(false);
        this.productsLoaded = true;
      },
      error: () => this.productsLoading.set(false)
    });
  }

  loadOrders() {
    this.ordersLoading.set(true);
    const params: any = { vendor: this.vendorId, page: this.ordersPage() };
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

  changeOrdersFilter() {
    this.ordersPage.set(1);
    this.loadOrders();
  }

  loadReport() {
    this.reportLoading.set(true);
    this.api.getAdminVendorSalesReport(this.vendorId, { period: this.reportPeriod() }).subscribe({
      next: (r) => {
        this.report.set(r);
        this.reportLoading.set(false);
        this.reportLoaded = true;
      },
      error: () => this.reportLoading.set(false)
    });
  }

  setPeriod(p: Period) {
    this.reportPeriod.set(p);
    this.reportLoaded = false;
    this.loadReport();
  }

  setStatus(newStatus: string) {
    if (!confirm(`Set vendor status to "${newStatus}"?`)) return;
    this.actionLoading.set(true);
    this.api.setVendorStatus(this.vendorId, newStatus).subscribe({
      next: () => { this.actionLoading.set(false); this.loadVendor(); },
      error: () => this.actionLoading.set(false)
    });
  }

  vendorColor(name: string): string {
    const colors = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#EF4444','#06B6D4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  statusBadge(s: string): string {
    const map: Record<string, string> = { approved: 'badge-approved', pending: 'badge-pending', suspended: 'badge-suspended', rejected: 'badge-rejected' };
    return map[s] || '';
  }

  orderStatusBadge(s: string): string {
    const map: Record<string, string> = { delivered: 'badge-approved', placed: 'badge-pending', cancelled: 'badge-rejected', preparing: 'badge-warning', confirmed: 'badge-info', on_the_way: 'badge-info', picked_up: 'badge-info' };
    return map[s] || '';
  }

  maxBarValue(): number {
    const data = this.report()?.monthly_data || [];
    return Math.max(...data.map((d: any) => d.revenue), 1);
  }

  onLogoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.logoUploading.set(true);
    this.api.uploadVendorLogo(this.vendorId, file).subscribe({
      next: (v) => { this.vendor.set({ ...this.vendor(), logo: v.logo }); this.logoUploading.set(false); },
      error: () => this.logoUploading.set(false)
    });
  }

  changeProductsPage(p: number) {
    this.productsPage.set(p);
    this.loadProducts();
  }

  changeOrdersPage(p: number) {
    this.ordersPage.set(p);
    this.loadOrders();
  }
}
