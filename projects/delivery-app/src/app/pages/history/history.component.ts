import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertService,
  ApiService,
  AppCurrencyPipe,
  Order,
} from '@shared/public-api';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
})
export class HistoryComponent implements OnInit {
  private api = inject(ApiService);
  private alerts = inject(AlertService);
  orders = signal<Order[]>([]);
  loading = signal(true);
  activeFilter = signal<'delivered' | 'cancelled'>('delivered');
  filteredOrders = computed(() =>
    this.orders().filter((order) => order.status === this.activeFilter()),
  );

  ngOnInit() {
    this.api.getDeliveryHistory({ status: ['delivered', 'cancelled'] }).subscribe({
      next: (r) => {
        this.orders.set(r.results || r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.alerts.error('Could not load delivery history.');
      },
    });
  }
}
