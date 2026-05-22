import { Component } from '@angular/core';
import {
  type ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiService, ToastService } from '@shared/public-api';
import { OrdersComponent } from './orders.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('OrdersComponent', () => {
  let fixture: ComponentFixture<OrdersComponent>;
  let component: OrdersComponent;
  let api: jasmine.SpyObj<ApiService>;
  let toast: jasmine.SpyObj<ToastService>;

  const order = (overrides: Record<string, unknown> = {}) => ({
    id: 'order-1',
    order_number: '1001',
    customer_name: 'Asha Rao',
    items: [{ id: 'item-1' }],
    total: 540,
    status: 'placed',
    placed_at: '2026-05-13T10:00:00Z',
    ...overrides,
  });

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getVendorOrders',
      'updateOrderStatus',
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    api.getVendorOrders.and.returnValue(
      of({ results: [order()], count: 1 } as any),
    );

    await TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [
        provideRouter([{ path: 'live-orders', component: BlankComponent }]),
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('creates and loads the first page of orders on init', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(api.getVendorOrders).toHaveBeenCalledWith({ page: 1 });
    expect(component.loading()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('#1001');
    expect(fixture.nativeElement.textContent).toContain('Asha Rao');
  }));

  it('shows a loading state while the order request is pending', fakeAsync(() => {
    const pending = new Subject<any>();
    api.getVendorOrders.and.returnValue(pending.asObservable());

    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.loading-state')?.textContent,
    ).toContain('Loading orders');
    pending.next({ results: [], count: 0 });
    pending.complete();
  }));

  it('renders an empty state for all orders and for filtered views', fakeAsync(() => {
    api.getVendorOrders.and.returnValue(of({ results: [], count: 0 } as any));
    component.statusFilter.set('ready');

    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.empty-state')?.textContent,
    ).toContain('No orders are currently ready.');
  }));

  it('recovers from load errors without leaving the page in a loading state', fakeAsync(() => {
    api.getVendorOrders.and.returnValue(throwError(() => new Error('network')));

    fixture.detectChanges();
    tick(0);

    expect(component.loading()).toBeFalse();
    expect(component.orders()).toEqual([]);
  }));

  it('filters orders by status and resets pagination', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    api.getVendorOrders.calls.reset();
    component.page.set(3);

    const select = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    select.value = 'confirmed';
    select.dispatchEvent(new Event('change'));
    tick();

    expect(component.statusFilter()).toBe('confirmed');
    expect(component.page()).toBe(1);
    expect(api.getVendorOrders).toHaveBeenCalledWith({
      page: 1,
      status: 'confirmed',
    });
  }));

  it('manual reload returns to page one and reloads the current filter', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    api.getVendorOrders.calls.reset();
    component.page.set(4);
    component.statusFilter.set('preparing');

    fixture.nativeElement.querySelector('.btn-icon').click();
    tick();

    expect(component.page()).toBe(1);
    expect(api.getVendorOrders).toHaveBeenCalledWith({
      page: 1,
      status: 'preparing',
    });
  }));

  it('toggles auto reload from the toolbar button', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    fixture.nativeElement.querySelector('.reload-toggle').click();
    fixture.detectChanges();

    expect(component.autoReload()).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('.reload-toggle').textContent,
    ).toContain('Paused');
  }));

  it('paginates within bounds and exposes nearby page numbers', fakeAsync(() => {
    api.getVendorOrders.and.returnValue(
      of({ results: [order()], count: 90 } as any),
    );
    fixture.detectChanges();
    tick(0);
    api.getVendorOrders.calls.reset();

    component.setPage(3);
    expect(component.page()).toBe(3);
    expect(component.pageNumbers()).toEqual([1, 2, 3, 4, 5]);
    expect(api.getVendorOrders).toHaveBeenCalledWith({ page: 3 });

    api.getVendorOrders.calls.reset();
    component.setPage(0);
    component.setPage(99);
    expect(api.getVendorOrders).not.toHaveBeenCalled();
  }));

  it('progresses placed, confirmed, and preparing orders from their action buttons', fakeAsync(() => {
    api.getVendorOrders.and.returnValues(
      of({ results: [order({ status: 'placed' })], count: 1 } as any),
      of({ results: [order({ status: 'confirmed' })], count: 1 } as any),
      of({ results: [order({ status: 'preparing' })], count: 1 } as any),
    );
    api.updateOrderStatus.and.returnValue(of({} as any));

    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '.status-btn.confirm',
      ) as HTMLButtonElement
    ).click();
    tick();

    expect(api.updateOrderStatus).toHaveBeenCalledWith('order-1', 'confirmed');
    expect(toast.show).toHaveBeenCalledWith(
      'Order updated to "confirmed".',
      'success',
    );
    expect(component.updatingId()).toBeNull();
  }));

  it('surfaces status update errors and clears the updating state', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    api.updateOrderStatus.and.returnValue(
      throwError(() => ({ error: { error: 'Kitchen closed' } })),
    );

    component.updateStatus(order() as any, 'confirmed');
    tick();

    expect(component.updatingId()).toBeNull();
    expect(toast.show).toHaveBeenCalledWith('Kitchen closed', 'error');
  }));

  it('supports array API responses and the default status update error message', fakeAsync(() => {
    api.getVendorOrders.and.returnValue(
      of([order({ id: 'order-array' })] as any),
    );
    fixture.detectChanges();
    tick(0);
    expect(component.total()).toBe(1);
    expect(component.orders()[0].id).toBe('order-array');

    api.updateOrderStatus.and.returnValue(throwError(() => ({ error: {} })));
    component.updateStatus(order() as any, 'ready');
    tick();
    expect(toast.show).toHaveBeenCalledWith('Failed to update order.', 'error');
  }));
});
