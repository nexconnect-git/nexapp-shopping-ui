import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '@shared/public-api';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DynamicTableComponent,
    TableCellDirective,
    AppCurrencyPipe,
  ],
  templateUrl: './vendors.component.html',
  styleUrl: './vendors.component.scss',
})
export class VendorsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  vendors = signal<any[]>([]);
  loading = signal(true);
  total = signal(0);
  search = '';
  statusFilter = '';
  actionId = signal<string | null>(null);

  page = signal(1);
  itemsPerPage = 20;
  Math = Math;

  tableColumns = [
    { key: 'vendor', label: 'Vendor', flex: '2.5fr' },
    { key: 'city', label: 'City', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'rating', label: 'Rating', flex: '1.2fr' },
    { key: 'min_order', label: 'Min Order', flex: '1fr' },
    { key: 'actions', label: 'Actions', flex: '1.5fr' },
  ];

  lastRefreshed = signal<Date | null>(null);
  autoReload = signal(true);
  private reloadSub?: Subscription;

  vendorColor(name: string): string {
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

  private timer: any;

  ngOnInit() {
    this.reloadSub = timer(0, 15000).subscribe(() => {
      if (this.autoReload()) this.load();
    });
  }

  ngOnDestroy() {
    this.reloadSub?.unsubscribe();
  }

  manualReload() {
    this.page.set(1);
    this.load();
  }
  toggleAutoReload() {
    this.autoReload.update((v) => !v);
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.search) params.search = this.search;
    if (this.statusFilter) params.status = this.statusFilter;
    this.api.getAdminVendors(params).subscribe({
      next: (r) => {
        this.vendors.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.loading.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    this.page.set(1);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), 400);
  }

  changePage(p: number) {
    if (p >= 1 && p <= Math.ceil(this.total() / this.itemsPerPage)) {
      this.page.set(p);
      this.load();
    }
  }

  setStatus(v: any, newStatus: string) {
    const reason =
      newStatus === 'approved'
        ? ''
        : window.prompt(`Reason for setting vendor status to "${newStatus}"?`)?.trim();
    if (newStatus !== 'approved' && !reason) return;
    this.actionId.set(v.id);
    this.api.setVendorStatus(v.id, newStatus, reason || '').subscribe({
      next: () => {
        this.actionId.set(null);
        this.load();
      },
      error: () => this.actionId.set(null),
    });
  }

  deleteVendor(v: any) {
    if (!confirm(`Delete vendor "${v.store_name}"? This is permanent.`)) return;
    this.api.deleteAdminVendor(v.id).subscribe({ next: () => this.load() });
  }

  ratingIcons(rating: unknown): string[] {
    const value = this.normalizedRating(rating);
    return Array.from({ length: 5 }, (_, index) =>
      index < value ? 'star' : 'star_border',
    );
  }

  ratingLabel(rating: unknown): string {
    return `${this.normalizedRating(rating)} out of 5`;
  }

  private normalizedRating(rating: unknown): number {
    const value = Math.round(Number(rating) || 0);
    return Math.max(0, Math.min(5, value));
  }

}

