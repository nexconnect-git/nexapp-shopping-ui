import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  listFromResponse,
  normalizeOrder as normalizeSharedOrder,
} from '@nexconnect/customer-core';
import { firstValueFrom, map, Observable } from 'rxjs';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { AppStateService } from './app-state.service';
import { UiService } from './ui.service';
import { Order } from '../models';
import { CustomerOrderApiService } from './customer-order-api.service';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly orderApi = inject(CustomerOrderApiService);
  private readonly auth = inject(SharedAuthService);
  private readonly state = inject(AppStateService);
  private readonly ui = inject(UiService);
  orders = signal<Order[]>([]);
  loading = signal(false);
  error = signal('');
  page = signal(1);
  count = signal(0);
  nextPage = signal(false);
  summary = signal<Record<string, number>>({});
  detailVersion = signal(0);
  detailErrors = signal<Record<string, string>>({});
  actionError = signal('');
  pendingAction = signal('');
  private cache = new Map<string, Order>();
  private pending = new Set<string>();
  private request = 0;
  private session = 0;
  private filter = '';
  private search = '';
  private authSession = -1;
  constructor() {
    effect(() => {
      const identity = this.auth.user()?.id;
      if(this.authSession===this.auth.sessionVersion)return;
      this.authSession=this.auth.sessionVersion;
      untracked(() => {
      if(this.pendingAction()) this.ui.resolveConfirm(false);
      this.pendingAction.set('');
      this.actionError.set('');
      this.session++;
      this.request++;
      this.cache.clear();
      this.pending.clear();
      this.detailErrors.set({});
      this.orders.set([]);
      this.detailVersion.update((v) => v + 1);
      if (identity) this.loadOrders();
      else {
        this.loading.set(false);
        this.error.set('');
        this.count.set(0);
        this.summary.set({});
      }
      });
    });
  }
  loadOrders(page = 1, status = this.filter, search = this.search): void {
    if (!this.auth.isLoggedIn()) return;
    this.filter = status;
    this.search = search;
    const request = ++this.request;
    const session = this.session;
    this.loading.set(true);
    this.error.set('');
    this.orderApi.getOrders(status, { page, search }).subscribe({
      next: (response) => {
        if (session !== this.session || request !== this.request) return;
        const orders = listFromResponse<any>(response).map((raw) =>
          this.mapOrder(raw)
        );
        this.orders.set(orders);
        orders.forEach((order) => this.cache.set(order.id, order));
        this.detailVersion.update((v) => v + 1);
        this.page.set(page);
        this.count.set(response.count ?? orders.length);
        this.summary.set(response.summary || {});
        this.nextPage.set(!!response.next);
        this.loading.set(false);
      },
      error: () => {
        if (session !== this.session || request !== this.request) return;
        this.error.set(
          'Your session and basket are kept. Try loading your order history again.'
        );
        this.loading.set(false);
      },
    });
  }
  getOrder(id: string | null): Order {
    this.detailVersion();
    const key = String(id || '');
    const cached = this.cache.get(key);
    if (key && !cached && !this.pending.has(key) && !this.detailErrors()[key])
      this.refreshOrder(key);
    return (
      cached || {
        id: 'loading',
        date: '',
        time: '',
        amount: 0,
        items: [],
        status: 'Active',
        payment: '',
      }
    );
  }
  refreshOrder(key: string): void {
    if (!key || !this.auth.isLoggedIn() || this.pending.has(key)) return;
    const session = this.session;
    this.pending.add(key);
    this.detailErrors.update((errors) => ({ ...errors, [key]: '' }));
    this.orderApi.getOrder(key).subscribe({
      next: (raw) => {
        if (session !== this.session) return;
        this.pending.delete(key);
        this.store(this.mapOrder(raw));
      },
      error: (error) => {
        if (session !== this.session) return;
        this.pending.delete(key);
        const status = error.status;
        if ([401, 403, 404].includes(status)) {
          this.cache.delete(key);
          this.orders.update((list) => list.filter((order) => order.id !== key));
        }
        this.detailErrors.update((errors) => ({
          ...errors,
          [key]:
            status === 404
              ? 'This order could not be found.'
              : status === 403
              ? 'This order is not available to this account.'
              : 'Order details could not refresh. Please try again.',
        }));
        this.detailVersion.update((v) => v + 1);
      },
    });
  }
  private store(order: Order): void {
    this.cache.set(order.id, order);
    this.orders.update((list) =>
      list.map((item) => (item.id === order.id ? order : item))
    );
    this.detailVersion.update((v) => v + 1);
  }
  placeOrder(
    payment: string,
    options: { codUpiConfirmed?: boolean; scheduledFor?: string | null } = {}
  ): Observable<Order> {
    return this.state.placeOrder(payment, options).pipe(
      map((order) => {
        this.store(order);
        return order;
      })
    );
  }
  async reorder(order: Order, trigger?: HTMLElement | null): Promise<void> {
    if (this.pendingAction()) return;
    const returnFocus = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const session = this.auth.sessionVersion;
    this.pendingAction.set(order.id);
    this.actionError.set('');
    try {
      const preview = await firstValueFrom(
        this.orderApi.reorder(order.id, true)
      );
      if(session !== this.auth.sessionVersion) return;
      const items = preview.items || [];
      const skipped = preview.skipped || [];
      if (!items.length) {
        this.actionError.set(
          'No items from this order are currently available. Your basket is unchanged.'
        );
        return;
      }
      const confirmed = await this.ui.confirm({
        title: 'The favourites. A fresh check.',
        eyebrow: 'Reorder / Review changes',
        message: 'Prices, stock and delivery availability may have changed since your last order. Reordering creates a current basket, not a copy of historical charges.',
        items: items.map((item: any) => ({
          id: item.product_id,
          name: item.name,
          image: order.items.find(original => original.id === item.product_id)?.image,
          quantity: Number(item.quantity),
          price: Number(item.price),
          previousPrice: Number(item.previous_price),
          previousQuantity: Number(item.previous_quantity),
        })),
        notice: (skipped.length ? 'Unavailable items: ' + skipped.join(', ') + '. ' : '') + (this.state.itemCount() ? 'Confirm before replacing your existing basket.' : 'Available items will be checked again before they are added.'),
        footnote: 'The historical order amount remains unchanged. Reorder revalidates the resulting single-store basket.',
        confirmText: 'Use these items',
        confirmIcon: 'bag',
        cancelText: 'Keep current basket',
        tone: 'warning',
      }, returnFocus);
      if (!confirmed || session !== this.auth.sessionVersion) return;
      const response = await firstValueFrom(this.orderApi.reorder(order.id));
      if(session !== this.auth.sessionVersion) return;
      this.state.loadCart();
      this.state.openMiniCart();
      this.state.showToast(
        response.skipped?.length
          ? `Basket updated. Unavailable items skipped: ${response.skipped.join(
              ', '
            )}`
          : 'Available items added to your basket',
        response.skipped?.length ? 'warning' : 'success'
      );
    } catch (error: any) {
      if(session !== this.auth.sessionVersion) return;
      this.actionError.set(
        error.body?.error || 'This order could not be reordered. Please retry.'
      );
    } finally {
      if(session === this.auth.sessionVersion) this.pendingAction.set('');
    }
  }
  cancelOrder(order: Order, reason = ''): Observable<Order> {
    const session=this.auth.sessionVersion;
    return this.orderApi.cancelOrder(order.id, reason).pipe(
      map((raw) => {
        const updated = this.mapOrder(raw);
        if(session===this.auth.sessionVersion){this.store(updated);this.state.loadActiveOrder();}
        return updated;
      })
    );
  }
  submitRating(
    id: string,
    payload: {
      vendor_rating: number;
      vendor_comment?: string;
      delivery_rating?: number;
      delivery_comment?: string;
    }
  ): Observable<any> {
    return this.orderApi.submitOrderRating(id, payload);
  }
  private mapOrder(raw: any): Order {
    return normalizeSharedOrder(raw) as Order;
  }
}
