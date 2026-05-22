import {
  Component,
  computed,
  DestroyRef,
  inject,
  NgZone,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  AppCurrencyPipe,
  AuthService,
  openAuthenticatedWebSocket,
  Order,
  ToastService,
} from '@shared/public-api';
import { environment } from '../../../environments/environment';
import {
  VendorOrderAction,
  VendorOrderActionsService,
} from '../../services/vendor-order-actions.service';

type BoardColumn = {
  key: string;
  title: string;
  icon: string;
  orders: Order[];
};

@Component({
  selector: 'app-live-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './live-orders.component.html',
  styleUrl: './live-orders.component.scss',
})
export class LiveOrdersComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private orderActions = inject(VendorOrderActionsService);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  orders = signal<Order[]>([]);
  loading = signal(true);
  busyOrder = signal<string | null>(null);
  lastUpdated = signal<Date | null>(null);
  socketState = signal<'connecting' | 'live' | 'offline' | 'reconnecting'>(
    'connecting',
  );
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  columns = computed<BoardColumn[]>(() => {
    const buckets: BoardColumn[] = [
      { key: 'new', title: 'New', icon: 'fiber_new', orders: [] },
      { key: 'confirmed', title: 'Confirmed', icon: 'task_alt', orders: [] },
      { key: 'preparing', title: 'Preparing', icon: 'restaurant', orders: [] },
      { key: 'ready', title: 'Ready', icon: 'shopping_bag', orders: [] },
      {
        key: 'driver_search',
        title: 'Driver Search',
        icon: 'radar',
        orders: [],
      },
      {
        key: 'driver_assigned',
        title: 'Driver Assigned',
        icon: 'two_wheeler',
        orders: [],
      },
      {
        key: 'picked_up',
        title: 'Picked Up',
        icon: 'local_shipping',
        orders: [],
      },
      {
        key: 'completed',
        title: 'Completed',
        icon: 'check_circle',
        orders: [],
      },
      { key: 'cancelled', title: 'Cancelled', icon: 'cancel', orders: [] },
    ];
    for (const order of this.orders()) {
      const key = this.boardKey(order);
      buckets.find((c) => c.key === key)?.orders.push(order);
    }
    return buckets;
  });

  ngOnInit() {
    this.load();
    this.connectOperationsSocket();
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.ws?.close();
    });
  }

  load() {
    this.loading.set(true);
    this.api.getVendorLiveOrders().subscribe({
      next: (r) => {
        this.orders.set(r.results || r);
        this.lastUpdated.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.socketState.set('offline');
        this.toast.show('Failed to load live orders.', 'error');
      },
    });
  }

  accept(order: Order) {
    this.run(order, 'accept', 'Order accepted.');
  }
  startPreparing(order: Order) {
    this.run(order, 'start_preparing', 'Order moved to preparing.');
  }
  markReady(order: Order) {
    this.run(order, 'mark_ready', 'Order marked ready.');
  }

  reject(order: Order) {
    const reason = window.prompt(
      `Reject order #${order.order_number}? Add a reason for the customer.`,
      'Item unavailable',
    );
    if (reason === null) return;
    this.run(order, 'reject', 'Order rejected.', { reason });
  }

  findDriver(order: Order) {
    this.run(order, 'start_delivery_search', 'Delivery search started.');
  }

  canFindDriver(order: Order): boolean {
    return (
      order.status === 'ready' &&
      !order.delivery_partner &&
      !['searching', 'notified', 'accepted'].includes(
        order.assignment_status || '',
      )
    );
  }

  private run(
    order: Order,
    action: VendorOrderAction,
    message: string,
    data: Record<string, any> = {},
  ) {
    this.busyOrder.set(order.id);
    this.orderActions.run(order.id, action, data).subscribe({
      next: (updated: Order) => {
        this.upsertOrder(updated);
        this.busyOrder.set(null);
        this.toast.show(message, 'success');
      },
      error: (err: any) => {
        this.busyOrder.set(null);
        this.toast.show(this.orderActions.errorMessage(err), 'error');
      },
    });
  }

  private connectOperationsSocket() {
    const wsPrefix = environment.apiBaseUrl.replace(/\/api$/, '');
    this.ws = openAuthenticatedWebSocket(
      `${wsPrefix}/ws/vendor/operations/`,
      this.auth.getToken(),
    );
    this.ws.onopen = () =>
      this.zone.run(() => {
        this.reconnectAttempts = 0;
        this.socketState.set('live');
      });
    this.ws.onclose = () => this.zone.run(() => this.scheduleReconnect());
    this.ws.onerror = () =>
      this.zone.run(() => this.socketState.set('offline'));
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (
        data.event === 'order_created' ||
        data.event === 'order_updated' ||
        data.type === 'order_created' ||
        data.type === 'order_updated'
      ) {
        const order = data.payload?.order || data.order || data.payload;
        if (order?.id) this.zone.run(() => this.upsertOrder(order));
      }
    };
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.socketState.set('reconnecting');
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(
      () => this.connectOperationsSocket(),
      delay,
    );
  }

  private upsertOrder(order: Order) {
    this.orders.update((list) => {
      const idx = list.findIndex((o) => o.id === order.id);
      if (idx === -1) return [order, ...list];
      const copy = [...list];
      copy[idx] = order;
      return copy;
    });
    this.lastUpdated.set(new Date());
  }

  private boardKey(order: Order): string {
    if (
      order.status === 'ready' &&
      ['searching', 'notified'].includes(order.assignment_status || '')
    )
      return 'driver_search';
    if (order.delivery_partner || order.assignment_status === 'accepted')
      return 'driver_assigned';
    if (order.status === 'placed') return 'new';
    if (order.status === 'delivered') return 'completed';
    if (order.status === 'on_the_way' || order.status === 'picked_up')
      return 'picked_up';
    if (order.status === 'cancelled') return 'cancelled';
    return order.status;
  }

  minutesSince(order: Order): number {
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(order.placed_at).getTime()) / 60000),
    );
  }
}
