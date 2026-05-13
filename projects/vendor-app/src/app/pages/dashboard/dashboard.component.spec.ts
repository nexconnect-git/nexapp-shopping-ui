import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiService, AuthService, ToastService } from '@shared/public-api';
import { DashboardComponent } from './dashboard.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let api: jasmine.SpyObj<ApiService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: Router;

  const product = (overrides: Record<string, unknown> = {}) => ({
    id: 'product-1',
    name: 'Paneer Roll',
    stock: 4,
    newStock: 4,
    low_stock_threshold: 5,
    unit: 'pcs',
    ...overrides
  });

  const stats = (overrides: Record<string, unknown> = {}) => ({
    is_open: false,
    closing_time: '',
    require_stock_check: false,
    total_orders: 12,
    total_products: 8,
    average_rating: 4.4,
    total_ratings: 22,
    low_stock_count: 1,
    low_stock_products: [product()],
    recent_orders: [
      {
        id: 'order-1',
        order_number: '1001',
        customer_name: 'Asha Rao',
        total: 420,
        status: 'placed'
      }
    ],
    ...overrides
  });

  const ops = {
    today: { revenue: 1500 },
    orders: { new: 2, preparing: 1, ready: 1 },
    delivery: { assigned: 1 },
    store: { is_accepting_orders: false, auto_order_acceptance: true },
    alerts: { low_stock: 1, product_attention: 0, pending_payouts: 0, support_open: 1 }
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getVendorDashboard',
      'getVendorOperationsSummary',
      'setStoreStatus',
      'getVendorProducts',
      'bulkUpdateVendorStock'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    api.getVendorDashboard.and.returnValue(of(stats() as any));
    api.getVendorOperationsSummary.and.returnValue(of(ops as any));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([
          { path: 'orders/:id', component: BlankComponent },
          { path: 'orders', component: BlankComponent },
          { path: 'live-orders', component: BlankComponent },
          { path: 'inventory', component: BlankComponent }
        ]),
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => fixture.destroy());

  it('creates the dashboard and renders analytics, operations, empty, and low stock information', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(api.getVendorDashboard).toHaveBeenCalled();
    expect(api.getVendorOperationsSummary).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Vendor Dashboard');
    expect(fixture.nativeElement.textContent).toContain('Today Revenue');
    expect(fixture.nativeElement.textContent).toContain('1 product is running low on stock');
    expect(fixture.nativeElement.textContent).toContain('#1001');
  }));

  it('shows loading while analytics are pending and an error state when stats fail', fakeAsync(() => {
    const pending = new Subject<any>();
    api.getVendorDashboard.and.returnValue(pending.asObservable());
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')?.textContent).toContain('Loading analytics');
    pending.next(stats());
    pending.complete();

    api.getVendorDashboard.and.returnValue(throwError(() => new Error('network')));
    component.ngOnDestroy();
    component.loading.set(true);
    component.stats.set(null);
    component.ngOnInit();
    tick(0);
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Unable to load dashboard');
  }));

  it('ignores operations summary errors without blocking dashboard stats', fakeAsync(() => {
    api.getVendorOperationsSummary.and.returnValue(throwError(() => new Error('ops failed')));
    fixture.detectChanges();
    tick(0);

    expect(component.loading()).toBeFalse();
    expect(component.stats()).toBeTruthy();
    expect(component.ops()).toBeNull();
  }));

  it('opens the store modal for an offline store and validates closing time', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.store-toggle-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.showStoreModal()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.modal-box')?.textContent).toContain('Open Your Store');

    component.closingTime = '';
    component.confirmOpenStore();
    expect(toast.show).toHaveBeenCalledWith('Please enter a closing time.', 'error');
  }));

  it('opens and closes the store through the API with interaction state feedback', fakeAsync(() => {
    api.setStoreStatus.and.returnValue(of({ closing_time: '21:30' } as any));
    fixture.detectChanges();
    tick(0);

    component.closingTime = '21:30';
    component.confirmOpenStore();
    tick();
    expect(api.setStoreStatus).toHaveBeenCalledWith(true, '21:30');
    expect(component.stats()?.is_open).toBeTrue();
    expect(component.showStoreModal()).toBeFalse();
    expect(toast.show).toHaveBeenCalledWith('Store is now online!', 'success');

    component.toggleStore();
    tick();
    expect(api.setStoreStatus).toHaveBeenCalledWith(false);
    expect(component.stats()?.is_open).toBeFalse();
    expect(toast.show).toHaveBeenCalledWith('Store is now closed.', 'info');
  }));

  it('reports open and close store API failures without changing modal flow unexpectedly', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    api.setStoreStatus.and.returnValue(throwError(() => new Error('open failed')));
    component.confirmOpenStore();
    tick();
    expect(component.storeToggling()).toBeFalse();
    expect(toast.show).toHaveBeenCalledWith('Failed to open store.', 'error');

    component.stats.update(s => s ? { ...s, is_open: true } : s);
    component.toggleStore();
    tick();
    expect(toast.show).toHaveBeenCalledWith('Failed to update store status.', 'error');
  }));

  it('requires stock review before going online when the backend asks for it', fakeAsync(() => {
    api.getVendorDashboard.and.returnValue(of(stats({ require_stock_check: true }) as any));
    api.getVendorProducts.and.returnValue(of({ results: [product(), product({ id: 'product-2', stock: 20, low_stock_threshold: 5 })] } as any));
    fixture.detectChanges();
    tick(0);

    component.confirmOpenStore();
    tick();
    fixture.detectChanges();

    expect(api.getVendorProducts).toHaveBeenCalled();
    expect(component.showStockModal()).toBeTrue();
    expect(component.stockHasWarnings()).toBeTrue();

    component.stockMode = 'new';
    component.onStockModeChange();
    expect(component.stockProducts().every(p => p.newStock === 0)).toBeTrue();

    component.stockMode = 'previous';
    component.onStockModeChange();
    expect(component.stockProducts()[1].newStock).toBe(20);

    component.stockProducts.update(ps => ps.map(p => ({ ...p, newStock: 12 })));
    component.onStockInput();
    expect(component.stockHasWarnings()).toBeFalse();
  }));

  it('accepts raw array product responses during stock review', fakeAsync(() => {
    api.getVendorDashboard.and.returnValue(of(stats({ require_stock_check: true }) as any));
    api.getVendorProducts.and.returnValue(of([product({ id: 'array-product', stock: 9, low_stock_threshold: 2 })] as any));
    fixture.detectChanges();
    tick(0);

    component.confirmOpenStore();
    tick();

    expect(component.stockProducts()[0].id).toBe('array-product');
    expect(component.stockProducts()[0].newStock).toBe(9);
  }));

  it('saves reviewed stock before going online and blocks warning submissions', fakeAsync(() => {
    api.getVendorDashboard.and.returnValue(of(stats({ require_stock_check: true }) as any));
    api.getVendorProducts.and.returnValue(of({ results: [product({ stock: 10 })] } as any));
    api.bulkUpdateVendorStock.and.returnValue(of({} as any));
    api.setStoreStatus.and.returnValue(of({ closing_time: '22:00' } as any));
    fixture.detectChanges();
    tick(0);

    component.confirmOpenStore();
    tick();
    component.stockProducts.update(ps => ps.map(p => ({ ...p, newStock: 15 })));
    component.onStockInput();
    component.submitStock();
    tick();

    expect(api.bulkUpdateVendorStock).toHaveBeenCalledWith([{ id: 'product-1', stock: 15 }]);
    expect(api.setStoreStatus).toHaveBeenCalledWith(true, '22:00');

    api.bulkUpdateVendorStock.calls.reset();
    component.stockHasWarnings.set(true);
    component.submitStock();
    expect(api.bulkUpdateVendorStock).not.toHaveBeenCalled();
  }));

  it('handles stock review failures and stock save errors', fakeAsync(() => {
    api.getVendorDashboard.and.returnValue(of(stats({ require_stock_check: true }) as any));
    api.getVendorProducts.and.returnValue(throwError(() => new Error('products failed')));
    api.setStoreStatus.and.returnValue(of({ closing_time: '22:00' } as any));
    fixture.detectChanges();
    tick(0);

    component.confirmOpenStore();
    tick();
    expect(toast.show).toHaveBeenCalledWith('Could not load products, proceeding anyway.', 'info');
    expect(api.setStoreStatus).toHaveBeenCalledWith(true, '22:00');

    api.bulkUpdateVendorStock.and.returnValue(throwError(() => new Error('stock failed')));
    component.stockHasWarnings.set(false);
    component.stockProducts.set([product({ newStock: 9 }) as any]);
    component.submitStock();
    tick();
    expect(component.stockSubmitting()).toBeFalse();
    expect(toast.show).toHaveBeenCalledWith('Failed to update stock.', 'error');
  }));

  it('navigates to an order from row clicks and public viewOrder calls', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.order-row') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/orders', 'order-1']);

    component.viewOrder('order-2');
    expect(router.navigate).toHaveBeenCalledWith(['/orders', 'order-2']);
  }));

  it('detects low stock based on the edited daily quantity', () => {
    expect(component.isLowStock(product({ newStock: 5 }) as any)).toBeTrue();
    expect(component.isLowStock(product({ newStock: 6 }) as any)).toBeFalse();
    expect(component.isLowStock(product({ low_stock_threshold: 0, newStock: 0 }) as any)).toBeFalse();
  });
});
