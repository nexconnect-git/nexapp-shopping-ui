import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ApiService, AuthService } from '@shared/public-api';
import { OrdersComponent } from './orders.component';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = jasmine.createSpy('close');

  constructor(
    public url: string,
    public protocols?: string[],
  ) {
    FakeWebSocket.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe('Admin OrdersComponent', () => {
  let fixture: ComponentFixture<OrdersComponent>;
  let component: OrdersComponent;
  let api: jasmine.SpyObj<ApiService>;
  let auth: jasmine.SpyObj<AuthService>;
  let originalWebSocket: typeof WebSocket;
  let originalAnimationFrame: typeof requestAnimationFrame;
  let originalCancelAnimationFrame: typeof cancelAnimationFrame;

  const order = (overrides: Record<string, unknown> = {}) => ({
    id: 'order-1',
    order_number: '1001',
    customer_name: 'Nina',
    vendor_name: 'Spice Hub',
    total: 650,
    status: 'placed',
    placed_at: '2026-05-13T08:00:00Z',
    items: [{ id: 'item-1', quantity: 2, product_name: 'Roll', subtotal: 240 }],
    tracking: [],
    ...overrides,
  });

  const trackableOrder = () =>
    order({
      status: 'ready',
      vendor_info: { latitude: '12.90', longitude: '77.60' },
      delivery_latitude: '12.95',
      delivery_longitude: '77.65',
      delivery_address: {
        street: 'MG Road',
        city: 'Bengaluru',
        phone: '9999999999',
      },
      delivery_partner_info: {
        name: 'Rider One',
        vehicle_type: 'bike',
        vehicle_number: 'KA01',
        average_rating: 4.5,
      },
      tracking: [
        {
          id: 't1',
          status: 'ready',
          timestamp: '2026-05-13T08:10:00Z',
          description: 'Ready',
        },
      ],
    });

  beforeEach(async () => {
    originalWebSocket = window.WebSocket;
    originalAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    FakeWebSocket.instances = [];
    (window as any).WebSocket = FakeWebSocket;
    (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      setTimeout(() => cb(performance.now()), 0);
      return 1;
    };
    (window as any).cancelAnimationFrame = jasmine.createSpy(
      'cancelAnimationFrame',
    );
    (window as any).google = {
      maps: {
        Map: jasmine
          .createSpy('Map')
          .and.callFake(() => ({ fitBounds: jasmine.createSpy('fitBounds') })),
        Marker: jasmine.createSpy('Marker').and.callFake(() => ({
          setPosition: jasmine.createSpy('setPosition'),
          setMap: jasmine.createSpy('setMap'),
        })),
        Polyline: jasmine
          .createSpy('Polyline')
          .and.callFake(() => ({ setMap: jasmine.createSpy('setMap') })),
        LatLngBounds: jasmine
          .createSpy('LatLngBounds')
          .and.callFake(() => ({ extend: jasmine.createSpy('extend') })),
        Size: jasmine.createSpy('Size').and.callFake((w, h) => ({ w, h })),
        Point: jasmine.createSpy('Point').and.callFake((x, y) => ({ x, y })),
      },
    };

    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getAdminOrders',
      'updateAdminOrderStatus',
      'getAdminOrder',
    ]);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['getToken']);
    auth.getToken.and.returnValue('token');
    api.getAdminOrders.and.returnValue(
      of({ results: [order()], count: 1 } as any),
    );
    api.getAdminOrder.and.returnValue(of(trackableOrder() as any));

    await TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    (window as any).WebSocket = originalWebSocket;
    (window as any).requestAnimationFrame = originalAnimationFrame;
    (window as any).cancelAnimationFrame = originalCancelAnimationFrame;
    delete (window as any).google;
  });

  it('creates and loads the first page of orders on the timer subscription', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(api.getAdminOrders).toHaveBeenCalledWith({ page: 1 });
    expect(fixture.nativeElement.textContent).toContain('#1001');
    expect(component.loading()).toBeFalse();
  }));

  it('shows loading and empty states from the table component', fakeAsync(() => {
    const pending = new Subject<any>();
    api.getAdminOrders.and.returnValue(pending.asObservable());
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.loading-panel')?.textContent,
    ).toContain('Loading workspace data');

    pending.next({ results: [], count: 0 });
    pending.complete();
    tick();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.empty-state')?.textContent,
    ).toContain('No orders found');
  }));

  it('supports raw array responses and clears loading after API errors', fakeAsync(() => {
    api.getAdminOrders.and.returnValue(of([order({ id: 'raw-order' })] as any));
    component.load();
    tick();
    expect(component.orders()[0].id).toBe('raw-order');
    expect(component.total()).toBe(1);

    api.getAdminOrders.and.returnValue(throwError(() => new Error('network')));
    component.load();
    tick();
    expect(component.loading()).toBeFalse();
  }));

  it('debounces search, applies status filters, reloads manually, toggles auto refresh, and paginates', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    api.getAdminOrders.calls.reset();

    const input = fixture.nativeElement.querySelector(
      '.toolbar-search input',
    ) as HTMLInputElement;
    input.value = '1001';
    input.dispatchEvent(new Event('input'));
    tick(399);
    expect(api.getAdminOrders).not.toHaveBeenCalled();
    tick(1);
    expect(api.getAdminOrders).toHaveBeenCalledWith({
      page: 1,
      search: '1001',
    });

    component.statusFilter = 'ready';
    component.load();
    expect(api.getAdminOrders).toHaveBeenCalledWith({
      page: 1,
      status: 'ready',
      search: '1001',
    });

    component.page.set(3);
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('.admin-page-actions .btn-ghost')
      .click();
    expect(component.page()).toBe(1);

    component.toggleAutoReload();
    expect(component.autoReload()).toBeFalse();

    component.setPage(2);
    expect(component.page()).toBe(2);
  }));

  it('computes available status transitions and ignores same-status updates', fakeAsync(() => {
    expect(
      component.getAvailableStatuses(order({ status: 'delivered' }) as any),
    ).toEqual(['delivered']);
    expect(
      component.getAvailableStatuses(order({ status: 'cancelled' }) as any),
    ).toEqual(['cancelled']);
    expect(
      component.getAvailableStatuses(order({ status: 'ready' }) as any),
    ).toContain('cancelled');

    component.updateStatus(order({ status: 'ready' }) as any, 'ready');
    expect(api.updateAdminOrderStatus).not.toHaveBeenCalled();
  }));

  it('updates order status and clears updating state on success and error', fakeAsync(() => {
    api.updateAdminOrderStatus.and.returnValue(of({} as any));
    component.updateStatus(order() as any, 'confirmed');
    tick();
    expect(api.updateAdminOrderStatus).toHaveBeenCalledWith(
      'order-1',
      'confirmed',
    );
    expect(component.updatingId()).toBeNull();

    api.updateAdminOrderStatus.and.returnValue(
      throwError(() => new Error('failed')),
    );
    component.updateStatus(order() as any, 'cancelled');
    tick();
    expect(component.updatingId()).toBeNull();
  }));

  it('loads full order details in a modal and handles detail errors', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    const details = new Subject<any>();
    api.getAdminOrder.and.returnValue(details.asObservable());
    (
      fixture.nativeElement.querySelector('.action-btn') as HTMLButtonElement
    ).click();
    expect(component.showModal()).toBeTrue();
    expect(component.loadingDetails()).toBeTrue();
    details.next(trackableOrder());
    details.complete();
    tick();
    fixture.detectChanges();

    expect(api.getAdminOrder).toHaveBeenCalledWith('order-1');
    expect(component.selectedOrder().delivery_partner_info.name).toBe(
      'Rider One',
    );
    expect(component.loadingDetails()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Live Tracking');

    api.getAdminOrder.and.returnValue(
      throwError(() => new Error('detail failed')),
    );
    component.viewDetails(order({ id: 'order-error' }) as any);
    tick();
    expect(component.loadingDetails()).toBeFalse();
    expect(component.selectedOrder().id).toBe('order-error');
  }));

  it('tracks only active delivery statuses and closes tracking resources with the modal', fakeAsync(() => {
    component.selectedOrder.set(order({ status: 'delivered' }) as any);
    expect(component.canTrackOrder()).toBeFalse();
    component.openTrackingMap();
    expect(component.showTrackingMap()).toBeFalse();

    component.selectedOrder.set(trackableOrder() as any);
    expect(component.canTrackOrder()).toBeTrue();
    component.openTrackingMap();
    expect(component.showTrackingMap()).toBeTrue();
    expect(FakeWebSocket.instances[0].url).toContain(
      '/sa/ws/delivery/order-1/tracking/',
    );
    expect(FakeWebSocket.instances[0].protocols).toEqual([
      'nexconnect.jwt',
      'token',
    ]);

    FakeWebSocket.instances[0].emit({ type: 'ignored' });
    FakeWebSocket.instances[0].emit({
      type: 'location_update',
      lat: 12.91,
      lng: 77.61,
    });
    tick(1);

    component.closeModal();
    expect(component.showModal()).toBeFalse();
    expect(component.selectedOrder()).toBeNull();
    expect(component.showTrackingMap()).toBeFalse();
    expect(FakeWebSocket.instances[0].close).toHaveBeenCalled();
  }));

  it('destroys subscriptions, sockets, animation frame, and map overlays', fakeAsync(() => {
    component.selectedOrder.set(trackableOrder() as any);
    component.openTrackingMap();
    tick(1);
    const ws = FakeWebSocket.instances[0];
    (component as any).gmMap = {};
    (component as any).driverPos = { lat: 12.9, lng: 77.6 };
    (component as any).gmDriverMarker = {
      setPosition: jasmine.createSpy('setPosition'),
      setMap: jasmine.createSpy('setMap'),
    };
    ws.emit({ type: 'location_update', lat: 12.91, lng: 77.61 });
    tick(1);

    fixture.destroy();

    expect(ws.close).toHaveBeenCalled();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  }));

  it('runs animation updates inside Angular zone when driver movement changes', fakeAsync(() => {
    const zone = TestBed.inject(NgZone);
    spyOn(zone, 'run').and.callThrough();
    component.selectedOrder.set(trackableOrder() as any);
    component.openTrackingMap();
    tick(1);

    FakeWebSocket.instances[0].emit({
      type: 'location_update',
      lat: 12.91,
      lng: 77.61,
    });
    tick(1);
    FakeWebSocket.instances[0].emit({
      type: 'location_update',
      lat: 12.92,
      lng: 77.62,
    });
    tick(1600);

    expect(zone.run).toHaveBeenCalled();
  }));
});
