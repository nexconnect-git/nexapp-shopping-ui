import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AppCurrencyPipe } from '@shared/lib/pipes/currency.pipe';
import { ActiveOrderSummary } from '../../models';
import { CustomerApiClientService } from '../../services/customer-api-client.service';

@Component({
  standalone: true,
  imports: [RouterLink, AppCurrencyPipe],
  templateUrl: './order-confirmed.component.html',
  styleUrls: ['./order-confirmed.component.scss'],
})
export class OrderConfirmedComponent implements OnInit {
  summary = signal<ActiveOrderSummary | null>(null);
  loading = signal(true);
  error = signal('');

  constructor(
    private route: ActivatedRoute,
    private api: CustomerApiClientService,
  ) {}

  ngOnInit(): void {
    const id = String(this.route.snapshot.paramMap.get('id') || '').trim();
    if (!id) {
      this.error.set('Order not found.');
      this.loading.set(false);
      return;
    }
    const confirmation = this.api.client.orders.confirmation(
      id,
    ) as Promise<ActiveOrderSummary>;
    this.api
      .toObservable<ActiveOrderSummary>(confirmation)
      .subscribe({
        next: (response) => {
          this.summary.set(response);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('We could not load the order confirmation.');
          this.loading.set(false);
        },
      });
  }

  orderTotal(): number {
    return Number(this.summary()?.total || 0);
  }
}
