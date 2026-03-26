import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Order } from '@shared/public-api';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {
  private api = inject(ApiService);
  orders = signal<Order[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.getDeliveryHistory().subscribe({
      next: (r) => { this.orders.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
}
