import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe } from '@shared/public-api';

@Component({
  selector: 'app-dispatch-board',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, AppCurrencyPipe],
  templateUrl: './dispatch-board.component.html',
  styleUrl: './dispatch-board.component.scss',
})
export class DispatchBoardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private timer?: any;

  loading = signal(true);
  orders = signal<any[]>([]);
  partners = signal<any[]>([]);
  error = signal('');
  lastUpdated = signal<Date | null>(null);

  activeOrders = computed(() =>
    this.orders().filter((o) => !['delivered', 'cancelled'].includes(o.status)),
  );
  readyOrders = computed(() =>
    this.orders().filter((o) => o.status === 'ready'),
  );
  inTransit = computed(() =>
    this.orders().filter((o) => ['picked_up', 'on_the_way'].includes(o.status)),
  );
  pendingDispatch = computed(() =>
    this.orders().filter((o) =>
      ['placed', 'confirmed', 'preparing'].includes(o.status),
    ),
  );
  onlinePartners = computed(() =>
    this.partners().filter(
      (p) => p.status === 'active' || p.is_online || p.is_available,
    ),
  );

  ngOnInit() {
    this.load();
    this.timer = setInterval(() => this.load(false), 15000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.error.set('');

    this.api
      .getAdminOrders({ page_size: 100, ordering: '-placed_at' })
      .subscribe({
        next: (res) => {
          this.orders.set(res.results || res || []);
          this.lastUpdated.set(new Date());
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load live orders.');
          this.loading.set(false);
        },
      });

    this.api.getAdminDeliveryPartners({ page_size: 100 }).subscribe({
      next: (res) => this.partners.set(res.results || res || []),
      error: () => {},
    });
  }

  lane(status: string): any[] {
    return this.orders()
      .filter((o) => o.status === status)
      .slice(0, 8);
  }

  ageMinutes(order: any): number {
    const raw = order.placed_at || order.created_at;
    if (!raw) return 0;
    return Math.max(
      0,
      Math.round((Date.now() - new Date(raw).getTime()) / 60000),
    );
  }

  slaClass(order: any): string {
    const age = this.ageMinutes(order);
    if (age >= 35 && !['picked_up', 'on_the_way'].includes(order.status))
      return 'critical';
    if (age >= 20) return 'warning';
    return 'normal';
  }
}
