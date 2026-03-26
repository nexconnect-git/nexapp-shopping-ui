import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Order } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-available-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './available-orders.component.html',
  styleUrls: ['./available-orders.component.scss']
})
export class AvailableOrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  orders = signal<Order[]>([]);
  loading = signal(true);
  acceptingId = signal<string | null>(null);
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 10000).subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.api.getAvailableOrders().subscribe({
      next: (r) => { this.orders.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  accept(order: Order) {
    this.acceptingId.set(order.id);
    this.api.acceptDelivery(order.id).subscribe({
      next: () => { this.acceptingId.set(null); this.load(); },
      error: () => this.acceptingId.set(null)
    });
  }
}
