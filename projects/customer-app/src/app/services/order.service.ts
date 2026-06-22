import { effect, inject, Injectable, signal } from '@angular/core';
import {
  listFromResponse,
  normalizeOrder as normalizeSharedOrder,
} from '@nexconnect/customer-core';
import { map, Observable } from 'rxjs';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { AppStateService } from './app-state.service';
import { Order } from '../models';
import { CustomerOrderApiService } from './customer-order-api.service';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly orderApi = inject(CustomerOrderApiService);
  private readonly auth = inject(SharedAuthService);
  private readonly state = inject(AppStateService);
  private readonly _orders = signal<Order[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');
  private readonly orderCache = new Map<string, Order>();
  private readonly pendingOrderRequests = new Set<string>();

  readonly orders = this._orders.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) this.loadOrders();
      else {
        this._orders.set([]);
        this._loading.set(false);
        this._error.set('');
        this.orderCache.clear();
        this.pendingOrderRequests.clear();
      }
    });
  }

  loadOrders(): void {
    this._loading.set(true);
    this._error.set('');
    this.orderApi.getOrders().subscribe({
      next: (response) => {
        const orders = listFromResponse<any>(response).map((order) =>
          this.mapOrder(order),
        );
        this._orders.set(orders);
        orders.forEach((order) => this.orderCache.set(order.id, order));
        this._loading.set(false);
      },
      error: () => {
        this._orders.set([]);
        this._error.set('Could not load your orders right now.');
        this._loading.set(false);
      },
    });
  }

  getOrder(id: string | null): Order {
    const key = String(id || '');
    const cached =
      this.orderCache.get(key) ||
      this._orders().find(
        (order) => order.id === key || order.raw?.order_number === key,
      );
    if (key && !cached && !this.pendingOrderRequests.has(key)) {
      this.pendingOrderRequests.add(key);
      this.orderApi.getOrder(key).subscribe({
        next: (raw) => {
          const order = this.mapOrder(raw);
          this.orderCache.set(order.id, order);
          this._orders.update((list) => [
            order,
            ...list.filter((item) => item.id !== order.id),
          ]);
          this.pendingOrderRequests.delete(key);
        },
        error: () => {
          this.pendingOrderRequests.delete(key);
        },
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
    this.orderApi.reorder(order.id).subscribe({
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
    this.orderApi.cancelOrder(order.id).subscribe({
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
    return this.orderApi.submitOrderRating(orderId, payload);
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
