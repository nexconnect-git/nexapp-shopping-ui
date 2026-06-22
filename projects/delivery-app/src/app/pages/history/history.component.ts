import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertService,
  AppCurrencyPipe,
  Order,
} from '@shared/public-api';
import { DeliveryWorkflowFacade } from '../../services/delivery-workflow.facade';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
})
export class HistoryComponent implements OnInit {
  private workflow = inject(DeliveryWorkflowFacade);
  private alerts = inject(AlertService);
  orders = signal<Order[]>([]);
  loading = signal(true);
  activeFilter = signal<'delivered' | 'cancelled'>('delivered');
  filteredOrders = computed(() =>
    this.orders().filter((order) => order.status === this.activeFilter()),
  );

  ngOnInit() {
    this.workflow.getHistory({ status: ['delivered', 'cancelled'] }).subscribe({
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
