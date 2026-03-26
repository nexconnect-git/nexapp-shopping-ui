import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Order } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  orders = signal<Order[]>([]);
  loading = signal(true);
  statusFilter = '';
  private sub?: Subscription;

  ngOnInit() { 
    this.sub = timer(0, 10000).subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.api.getVendorOrders(this.statusFilter || undefined).subscribe({
      next: (r) => { this.orders.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  updateStatus(order: Order, status: string) {
    this.api.updateOrderStatus(order.id, status).subscribe({ next: () => this.load() });
  }
}
