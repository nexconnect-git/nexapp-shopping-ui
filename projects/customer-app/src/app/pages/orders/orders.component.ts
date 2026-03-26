import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Order } from '@shared/public-api';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit {
  private api = inject(ApiService);

  orders = signal<Order[]>([]);
  loading = signal(true);
  activeStatus = signal('');

  statusTabs = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'placed' },
    { label: 'Preparing', value: 'preparing' },
    { label: 'On the way', value: 'on_the_way' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getOrders(this.activeStatus() || undefined).subscribe({
      next: (r) => { this.orders.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setStatus(s: string) { this.activeStatus.set(s); this.load(); }
}
