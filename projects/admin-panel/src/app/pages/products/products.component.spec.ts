import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '@shared/public-api';
import { ProductsComponent } from './products.component';

describe('Admin ProductsComponent', () => {
  let fixture: ComponentFixture<ProductsComponent>;
  let component: ProductsComponent;
  let api: jasmine.SpyObj<ApiService>;
  let confirmSpy: jasmine.Spy;

  const product = (overrides: Record<string, unknown> = {}) => ({
    id: 'product-1',
    name: 'Paneer Roll',
    description: 'Fresh roll',
    price: 120,
    compare_price: 150,
    sku: 'ROLL-1',
    stock: 4,
    unit: 'pcs',
    weight: '250g',
    status: 'active',
    is_available: true,
    is_featured: false,
    category: { id: 'cat-1', name: 'Snacks' },
    vendor: { id: 'vendor-1', store_name: 'Spice Hub', city: 'Bengaluru' },
    vendor_name: 'Spice Hub',
    ...overrides
  });

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getAdminCategories',
      'getAdminProducts',
      'updateAdminProduct',
      'deleteAdminProduct'
    ]);
    api.getAdminCategories.and.returnValue(of({ results: [{ id: 'cat-1', name: 'Snacks' }] } as any));
    api.getAdminProducts.and.returnValue(of({ results: [product()], count: 1 } as any));
    confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [{ provide: ApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
  });

  it('creates, loads categories and grouped vendor products', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(api.getAdminCategories).toHaveBeenCalled();
    expect(api.getAdminProducts).toHaveBeenCalledWith({ page: 1, page_size: 100 });
    expect(component.vendorGroups()[0].vendorName).toBe('Spice Hub');
    expect(fixture.nativeElement.textContent).toContain('Paneer Roll');
  }));

  it('renders loading and empty states', fakeAsync(() => {
    const pending = new Subject<any>();
    api.getAdminProducts.and.returnValue(pending.asObservable());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')?.textContent).toContain('Loading products');

    pending.next({ results: [], count: 0 });
    pending.complete();
    tick();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-state')?.textContent).toContain('No products found');
  }));

  it('handles raw product and category arrays plus product load errors', fakeAsync(() => {
    api.getAdminCategories.and.returnValue(of([{ id: 'cat-2', name: 'Meals' }] as any));
    api.getAdminProducts.and.returnValue(of([product({ id: 'raw-product' })] as any));
    fixture.detectChanges();
    tick();

    expect(component.categories()[0].name).toBe('Meals');
    expect(component.allProducts()[0].id).toBe('raw-product');
    expect(component.total()).toBe(1);

    api.getAdminProducts.and.returnValue(throwError(() => new Error('network')));
    component.load();
    tick();
    expect(component.loading()).toBeFalse();
  }));

  it('debounces search and applies status filters', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    api.getAdminProducts.calls.reset();

    const input = fixture.nativeElement.querySelector('.search-input') as HTMLInputElement;
    input.value = 'roll';
    input.dispatchEvent(new Event('input'));
    tick(399);
    expect(api.getAdminProducts).not.toHaveBeenCalled();
    tick(1);
    expect(api.getAdminProducts).toHaveBeenCalledWith({ page: 1, page_size: 100, search: 'roll' });

    component.statusFilter = 'draft';
    component.onFilterChange();
    expect(api.getAdminProducts).toHaveBeenCalledWith({ page: 1, page_size: 100, search: 'roll', status: 'draft' });
  }));

  it('groups products by vendor fallbacks and toggles collapsed state from header clicks', fakeAsync(() => {
    const unknown = product({ id: 'p2', vendor: null, vendor_name: '', category: null, stock: 12 });
    api.getAdminProducts.and.returnValue(of({ results: [product(), unknown], count: 2 } as any));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(component.vendorGroups().length).toBe(2);
    expect(component.vendorGroups()[1].vendorName).toBe('Unknown Vendor');

    const header = fixture.nativeElement.querySelector('.vendor-header') as HTMLElement;
    header.click();
    expect(component.vendorGroups()[0].collapsed).toBeTrue();
    header.click();
    expect(component.vendorGroups()[0].collapsed).toBeFalse();
  }));

  it('opens edit modal with defaults, validates form, saves optional fields, and closes', fakeAsync(() => {
    api.updateAdminProduct.and.returnValue(of({} as any));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.action-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.showModal()).toBeTrue();
    expect(component.form.category).toBe('cat-1');

    component.form.name = ' ';
    component.save();
    expect(component.error()).toBe('Name is required.');

    component.form.name = 'Updated Roll';
    component.form.price = '';
    component.save();
    expect(component.error()).toBe('Price is required.');

    component.form.price = 140;
    component.save();
    tick();
    expect(api.updateAdminProduct).toHaveBeenCalledWith('product-1', jasmine.objectContaining({
      name: 'Updated Roll',
      compare_price: 150,
      sku: 'ROLL-1',
      weight: '250g'
    }));
    expect(component.showModal()).toBeFalse();

    component.openEdit(product({ compare_price: '', sku: '', weight: '', unit: '', status: '', category: null }) as any);
    expect(component.form.unit).toBe('pcs');
    expect(component.form.status).toBe('active');
    component.closeModal();
    expect(component.showModal()).toBeFalse();
  }));

  it('reports save errors and keeps the modal usable', fakeAsync(() => {
    api.updateAdminProduct.and.returnValue(throwError(() => ({ error: { detail: 'Invalid price' } })));
    component.openEdit(product() as any);
    component.save();
    tick();

    expect(component.saving()).toBeFalse();
    expect(component.error()).toBe('Invalid price');

    api.updateAdminProduct.and.returnValue(throwError(() => ({ error: {} })));
    component.save();
    tick();
    expect(component.error()).toBe('Save failed.');
  }));

  it('confirms delete requests and skips API calls when cancelled', fakeAsync(() => {
    api.deleteAdminProduct.and.returnValue(of({} as any));
    component.delete(product() as any);
    tick();
    expect(confirmSpy).toHaveBeenCalledWith('Delete "Paneer Roll"? This cannot be undone.');
    expect(api.deleteAdminProduct).toHaveBeenCalledWith('product-1');

    confirmSpy.and.returnValue(false);
    api.deleteAdminProduct.calls.reset();
    component.delete(product() as any);
    expect(api.deleteAdminProduct).not.toHaveBeenCalled();
  }));

  it('formats status and stock classes across edge cases', () => {
    expect(component.statusLabel('coming_soon')).toBe('Coming Soon');
    expect(component.statusLabel('custom')).toBe('custom');
    expect(component.statusClass('sold_out')).toBe('chip-sold-out');
    expect(component.statusClass('custom')).toBe('');
    expect(component.stockClass(product({ stock: 0 }) as any)).toBe('stock-empty');
    expect(component.stockClass(product({ stock: 5 }) as any)).toBe('stock-low');
    expect(component.stockClass(product({ stock: 12 }) as any)).toBe('stock-ok');
  });
});
