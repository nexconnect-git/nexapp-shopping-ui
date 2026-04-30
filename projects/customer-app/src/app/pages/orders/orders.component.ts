import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, AppCurrencyPipe, Order } from '@shared/public-api';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppCurrencyPipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit {
  private api = inject(ApiService);
  private readonly activeStatuses = ['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way'];

  orders = signal<Order[]>([]);
  loading = signal(true);
  activeStatus = signal('');

  readonly filteredOrders = computed(() => {
    const active = this.activeStatus();
    const orders = this.orders();
    if (!active) return orders;
    if (active === 'active') {
      return orders.filter((order) => this.activeStatuses.includes(order.status));
    }
    return orders.filter((order) => order.status === active);
  });

  readonly statusTabs = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Preparing', value: 'preparing' },
    { label: 'On the way', value: 'on_the_way' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getOrders().subscribe({
      next: (r) => { this.orders.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setStatus(s: string) { this.activeStatus.set(s); this.load(); }
}
