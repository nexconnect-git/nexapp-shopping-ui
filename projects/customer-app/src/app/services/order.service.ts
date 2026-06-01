import { effect, inject, Injectable, signal } from '@angular/core';
import {
  listFromResponse,
  normalizeOrder as normalizeSharedOrder,
} from '@nexconnect/customer-core';
import { map, Observable } from 'rxjs';
import {
  ApiService,
  AuthService as SharedAuthService,
} from '@shared/public-api';
import { AppStateService } from './app-state.service';
import { Order } from '../models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(SharedAuthService);
  private readonly state = inject(AppStateService);
  private readonly _orders = signal<Order[]>([]);
  private readonly orderCache = new Map<string, Order>();

  readonly orders = this._orders.asReadonly();

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) this.loadOrders();
      else {
        this._orders.set([]);
        this.orderCache.clear();
      }
    });
  }

  loadOrders(): void {
    this.api.getOrders().subscribe({
      next: (response) => {
        const orders = listFromResponse<any>(response).map((order) =>
          this.mapOrder(order),
        );
        this._orders.set(orders);
        orders.forEach((order) => this.orderCache.set(order.id, order));
      },
      error: () => this._orders.set([]),
    });
  }

  getOrder(id: string | null): Order {
    const key = String(id || '');
    const cached =
      this.orderCache.get(key) ||
      this._orders().find(
        (order) => order.id === key || order.raw?.order_number === key,
      );
    if (key && !cached) {
      this.api.getOrder(key).subscribe({
        next: (raw) => {
          const order = this.mapOrder(raw);
          this.orderCache.set(order.id, order);
          this._orders.update((list) => [
            order,
            ...list.filter((item) => item.id !== order.id),
          ]);
        },
        error: () => {},
      });
    }
    return cached || this.emptyOrder(key);
  }

  placeOrder(
    paymentMethod: string,
    options: { codUpiConfirmed?: boolean; scheduledFor?: string | null } = {},
  ): Observable<Order> {
    return this.state.placeOrder(paymentMethod, options).pipe(
      map((order) => {
        this.orderCache.set(order.id, order);
        this._orders.update((list) => [
          order,
          ...list.filter((item) => item.id !== order.id),
        ]);
        return order;
      }),
    );
  }

  reorder(order: Order): void {
    if (!order?.id) return;
    this.api.reorder(order.id).subscribe({
      next: () => {
        this.state.loadCart();
        this.state.openMiniCart();
        this.state.showToast('Items added back to cart');
      },
      error: () => this.state.showToast('Could not reorder right now'),
    });
  }

  cancelOrder(order: Order): void {
    if (!order?.id) return;
    this.api.cancelOrder(order.id).subscribe({
      next: (raw) => {
        const updated = this.mapOrder(raw);
        this.orderCache.set(updated.id, updated);
        this._orders.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
      },
      error: () => this.state.showToast('Could not cancel order'),
    });
  }

  submitRating(
    orderId: string,
    payload: {
      vendor_rating: number;
      vendor_comment?: string;
      delivery_rating?: number;
      delivery_comment?: string;
    },
  ): Observable<any> {
    return this.api.submitOrderRating(orderId, payload);
  }

  private mapOrder(raw: any): Order {
    return normalizeSharedOrder(raw) as Order;
  }

  private emptyOrder(id: string): Order {
    return {
      id: id || 'loading',
      date: '',
      time: '',
      amount: 0,
      items: [],
      status: 'Active',
      payment: 'Payment pending',
    };
  }
}
