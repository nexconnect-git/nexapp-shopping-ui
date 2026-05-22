import { Component } from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiService, AuthService } from '@shared/public-api';
import { DashboardComponent } from './dashboard.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
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

describe('Admin DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let api: jasmine.SpyObj<ApiService>;
  let auth: jasmine.SpyObj<AuthService>;
  let originalWebSocket: typeof WebSocket;

  const stats = {
    total_revenue: 45000,
    pending_orders: 2,
    confirmed_orders: 1,
    preparing_orders: 3,
    ready_orders: 1,
    completed_orders: 10,
    cancelled_orders: 1,
    total_orders: 18,
    delivery_partners: 6,
    pending_delivery_partners: 2,
    vendors: 5,
    pending_vendors: 1,
    products: 40,
    customers: 100,
  };

  const order = {
    id: 'order-1',
    order_number: '1001',
    customer_name: 'Nina',
    vendor_name: 'Spice Hub',
    total: 650,
    status: 'placed',
  };

  const vendor = {
    id: 'vendor-1',
    store_name: 'Spice Hub',
    city: 'Bengaluru',
    average_rating: 4.6,
  };

  beforeEach(async () => {
    originalWebSocket = window.WebSocket;
    FakeWebSocket.instances = [];
    (window as any).WebSocket = FakeWebSocket;
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getAdminStats',
      'getAdminOrders',
      'getAdminVendors',
    ]);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['getToken']);
    auth.getToken.and.returnValue('token');
    api.getAdminStats.and.returnValue(of(stats as any));
    api.getAdminOrders.and.returnValue(
      of({ results: [order], count: 1 } as any),
    );
    api.getAdminVendors.and.returnValue(
      of({ results: [vendor], count: 1 } as any),
    );

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([
          { path: 'orders', component: BlankComponent },
          { path: 'vendors', component: BlankComponent },
          { path: 'delivery-partners', component: BlankComponent },
          { path: 'payments', component: BlankComponent },
        ]),
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    (window as any).WebSocket = originalWebSocket;
  });

  it('creates, loads KPI stats, opens the admin stats WebSocket, and renders table data', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(api.getAdminStats).toHaveBeenCalled();
    expect(api.getAdminOrders).toHaveBeenCalledWith({
      page_size: 5,
      ordering: '-placed_at',
    });
    expect(api.getAdminVendors).toHaveBeenCalledWith({
      status: 'approved',
      ordering: '-average_rating',
      page_size: 5,
    });
    expect(FakeWebSocket.instances[0].url).toContain('/sa/ws/admin/stats/');
    expect(FakeWebSocket.instances[0].protocols).toEqual([
      'nexconnect.jwt',
      'token',
    ]);
    expect(fixture.nativeElement.textContent).toContain(
      "Today's marketplace operations",
    );
    expect(fixture.nativeElement.textContent).toContain('#1001');
    expect(fixture.nativeElement.textContent).toContain('Spice Hub');
  }));

  it('updates stats from WebSocket messages and ignores unrelated messages', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    FakeWebSocket.instances[0].emit({ type: 'noop', data: { vendors: 999 } });
    expect(component.stats().vendors).toBe(5);

    FakeWebSocket.instances[0].emit({
      type: 'stats_update',
      data: { ...stats, vendors: 9 },
    });
    fixture.detectChanges();

    expect(component.stats().vendors).toBe(9);
    expect(component.loadingStats()).toBeFalse();
  }));

  it('uses HTTP fallback state for stats and retries on WebSocket error only while loading', fakeAsync(() => {
    const pending = new Subject<any>();
    api.getAdminStats.and.returnValue(pending.asObservable());
    fixture.detectChanges();
    tick(0);

    FakeWebSocket.instances[0].onerror?.();
    expect(api.getAdminStats).toHaveBeenCalledTimes(2);

    pending.next(stats);
    pending.complete();
    tick();
    component.loadingStats.set(false);
    FakeWebSocket.instances[0].onerror?.();
    expect(api.getAdminStats).toHaveBeenCalledTimes(2);
  }));

  it('renders loading, error, and empty states for independent dashboard tables', fakeAsync(() => {
    const pendingOrders = new Subject<any>();
    api.getAdminOrders.and.returnValue(pendingOrders.asObservable());
    api.getAdminVendors.and.returnValue(
      throwError(() => ({ error: { detail: 'Vendor API failed' } })),
    );
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.compact-loading'),
    ).toBeTruthy();

    pendingOrders.next([]);
    pendingOrders.complete();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No live transactions yet.',
    );
    expect(component.vendorsError()).toBe('Vendor API failed');
    expect(fixture.nativeElement.textContent).toContain('Vendor API failed');
  }));

  it('uses fallback table error messages and raw array responses', fakeAsync(() => {
    api.getAdminOrders.and.returnValue(throwError(() => ({ error: {} })));
    api.getAdminVendors.and.returnValue(of([vendor] as any));
    fixture.detectChanges();
    tick(0);

    expect(component.ordersError()).toBe('Failed to load transactions');
    expect(component.topVendors()[0].store_name).toBe('Spice Hub');
  }));

  it('limits recent orders and vendors to five items and formats star ratings', fakeAsync(() => {
    api.getAdminOrders.and.returnValue(
      of(
        Array.from({ length: 8 }, (_, i) => ({
          ...order,
          id: `o-${i}`,
        })) as any,
      ),
    );
    api.getAdminVendors.and.returnValue(
      of({
        results: Array.from({ length: 7 }, (_, i) => ({
          ...vendor,
          id: `v-${i}`,
        })),
      } as any),
    );
    fixture.detectChanges();
    tick(0);

    expect(component.recentOrders().length).toBe(5);
    expect(component.topVendors().length).toBe(5);
    expect(component.starsFor(3.6)).toBe('★★★★☆');
  }));

  it('closes the WebSocket on destroy', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    const ws = FakeWebSocket.instances[0];

    fixture.destroy();

    expect(ws.close).toHaveBeenCalled();
  }));
});
