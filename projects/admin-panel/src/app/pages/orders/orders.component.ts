import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Order } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, DynamicTableComponent, TableCellDirective],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  orders = signal<Order[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  statusFilter = '';
  search = '';
  updatingId = signal<string | null>(null);

  tableColumns = [
    { key: 'order_number', label: 'Order #', flex: '1fr' },
    { key: 'customer_name', label: 'Customer', flex: '1.5fr' },
    { key: 'vendor_name', label: 'Vendor', flex: '1.5fr' },
    { key: 'total', label: 'Total', flex: '1fr' },
    { key: 'status', label: 'Status', flex: '1fr' },
    { key: 'date', label: 'Date', flex: '1fr' },
    { key: 'actions', label: 'Update Status', flex: '1.5fr' }
  ];

  showModal = signal(false);
  selectedOrder = signal<any>(null);
  loadingDetails = signal(false);

  private timer: any;

  readonly statuses = ['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];
  private sub?: Subscription;

  ngOnInit() { 
    this.sub = timer(0, 15000).subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.search) params.search = this.search;
    this.api.getAdminOrders(params).subscribe({
      next: (r) => {
        this.orders.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(Math.ceil((r.count || 0) / 20) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() { clearTimeout(this.timer); this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 400); }
  setPage(p: number) { this.page.set(p); this.load(); }

  updateStatus(order: Order, newStatus: string) {
    if (order.status === newStatus) return;
    this.updatingId.set(order.id);
    this.api.updateAdminOrderStatus(order.id, newStatus).subscribe({
      next: () => { this.updatingId.set(null); this.load(); },
      error: () => this.updatingId.set(null)
    });
  }

  viewDetails(o: any) {
    this.loadingDetails.set(true);
    this.showModal.set(true);
    this.selectedOrder.set(o);
    this.api.getAdminOrder(o.id).subscribe({
      next: (fullOrder) => {
        this.selectedOrder.set(fullOrder);
        this.loadingDetails.set(false);
      },
      error: () => this.loadingDetails.set(false)
    });
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedOrder.set(null);
  }
}
