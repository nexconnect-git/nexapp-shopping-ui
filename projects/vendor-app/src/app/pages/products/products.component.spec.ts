import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiService, ToastService } from '@shared/public-api';
import { ProductsComponent } from './products.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('ProductsComponent', () => {
  let fixture: ComponentFixture<ProductsComponent>;
  let component: ProductsComponent;
  let api: jasmine.SpyObj<ApiService>;
  let toast: jasmine.SpyObj<ToastService>;

  const product = (overrides: Record<string, unknown> = {}) => ({
    id: 'product-1',
    name: 'Masala Dosa',
    sku: 'DOS-1',
    primary_image: '',
    image_count: 1,
    category: { id: 'cat-1', name: 'Breakfast' },
    price: 120,
    compare_price: 150,
    revenue: 900,
    stock: 3,
    unit: 'pcs',
    low_stock_threshold: 5,
    in_stock: true,
    sales_count: 7,
    category_visibility: 'visible',
    visibility_status: 'visible',
    visibility_blockers: [],
    approval_status: 'approved',
    approval_status_label: 'Approved',
    status: 'active',
    is_available: true,
    rejection_reason: '',
    ...overrides
  });

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['getVendorProducts', 'deleteProduct', 'submitInheritedProducts']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    api.getVendorProducts.and.returnValue(of({ results: [product()], count: 1 } as any));

    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        provideRouter([
          { path: 'products/new', component: BlankComponent },
          { path: 'products/edit/:id', component: BlankComponent },
          { path: 'inventory', component: BlankComponent }
        ]),
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('creates and loads the product catalogue with health summary data', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(api.getVendorProducts).toHaveBeenCalledWith({ page: 1 });
    expect(component.loading()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Masala Dosa');
    expect(fixture.nativeElement.querySelector('.low-stock-alert')?.textContent).toContain('low on stock');
  }));

  it('shows loading, empty, and error states from API outcomes', fakeAsync(() => {
    const pending = new Subject<any>();
    api.getVendorProducts.and.returnValue(pending.asObservable());
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-panel')?.textContent).toContain('Loading workspace data');
    pending.next({ results: [], count: 0 });
    pending.complete();

    api.getVendorProducts.and.returnValue(of({ results: [], count: 0 } as any));
    component.manualReload();
    tick();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-state')?.textContent).toContain('No products yet');

    api.getVendorProducts.and.returnValue(throwError(() => new Error('network')));
    component.manualReload();
    tick();
    expect(component.loading()).toBeFalse();
    expect(toast.show).toHaveBeenCalledWith('Failed to load products.', 'error');
  }));

  it('debounces search input and sends the query with the first page', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    api.getVendorProducts.calls.reset();
    component.page.set(3);

    const input = fixture.nativeElement.querySelector('.toolbar-search input') as HTMLInputElement;
    input.value = 'dosa';
    input.dispatchEvent(new Event('input'));
    tick(399);
    expect(api.getVendorProducts).not.toHaveBeenCalled();

    tick(1);
    expect(component.page()).toBe(1);
    expect(api.getVendorProducts).toHaveBeenCalledWith({ page: 1, search: 'dosa' });
  }));

  it('manual reload and auto reload toggle use the current UI controls', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    api.getVendorProducts.calls.reset();

    fixture.nativeElement.querySelector('.reload-toggle').click();
    fixture.detectChanges();
    expect(component.autoReload()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.reload-toggle').textContent).toContain('Paused');

    component.page.set(2);
    fixture.nativeElement.querySelector('.btn-icon').click();
    tick();
    expect(component.page()).toBe(1);
    expect(api.getVendorProducts).toHaveBeenCalledWith({ page: 1 });
  }));

  it('paginates within bounds and reports nearby page numbers', fakeAsync(() => {
    api.getVendorProducts.and.returnValue(of({ results: [product()], count: 100 } as any));
    fixture.detectChanges();
    tick(0);
    api.getVendorProducts.calls.reset();

    component.setPage(4);
    expect(component.page()).toBe(4);
    expect(component.pageNumbers()).toEqual([2, 3, 4, 5]);
    expect(api.getVendorProducts).toHaveBeenCalledWith({ page: 4 });

    api.getVendorProducts.calls.reset();
    component.setPage(0);
    component.setPage(10);
    expect(api.getVendorProducts).not.toHaveBeenCalled();
  }));

  it('classifies product approval and visibility health across edge cases', () => {
    expect(component.isLowStock(product() as any)).toBeTrue();
    expect(component.isLowStock(product({ stock: 8 }) as any)).toBeFalse();
    expect(component.needsAttention(product({ visibility_blockers: ['Missing photo'] }) as any)).toBeTrue();
    expect(component.needsAttention(product({ visibility_status: 'needs_attention', visibility_blockers: [] }) as any)).toBeTrue();
    expect(component.needsAttention(product({ visibility_status: 'visible', visibility_blockers: [] }) as any)).toBeFalse();
    expect(component.productHealthLabel(product({ visibility_status: 'needs_attention', visibility_blockers: undefined }) as any)).toBe('1 fix needed');
    expect(component.productHealthLabel(product({ visibility_blockers: ['Missing photo', 'No stock'] }) as any)).toBe('2 fixes needed');
    expect(component.categoryVisibilityLabel(product({ category_visibility: 'customer_visible' }) as any)).toBe('Customer visible');
    expect(component.categoryVisibilityLabel(product({ category_visibility: 'pending_review' }) as any)).toBe('Category pending');
    expect(component.categoryVisibilityLabel(product({ category_visibility: 'hidden' }) as any)).toBe('No category');
    expect(component.approvalClass(product({ approval_status: 'rejected' }) as any)).toContain('rejected');
    expect(component.approvalClass(product({ approval_status: undefined }) as any)).toBe('approval-chip draft');
    expect(component.approvalText(product({ approval_status: 'pending_approval', approval_status_label: undefined }) as any)).toBe('pending approval');
    expect(component.approvalText(product({ approval_status: undefined, approval_status_label: undefined }) as any)).toBe('Draft');
    expect(component.approvalReason(product({ approval_status: 'pending_approval' }) as any)).toBe('Hidden until admin approval.');
    expect(component.approvalReason(product({ approval_status: 'rejected', rejection_reason: 'Bad image' }) as any)).toBe('Bad image');
    expect(component.approvalReason(product({ approval_status: 'rejected', rejection_reason: '' }) as any)).toBe('Rejected by admin.');
    expect(component.approvalReason(product({ approval_status: 'draft' }) as any)).toBe('Draft products are not customer visible.');
    expect(component.approvalReason(product({ is_available: false }) as any)).toBe('Approved but offline.');
    expect(component.canSubmitForApproval(null)).toBeFalse();
    expect(component.canSubmitForApproval(product({ approval_status: 'approved' }) as any)).toBeFalse();
    expect(component.canSubmitForApproval(product({ approval_status: 'draft', image_count: 1, stock: 1, category: { name: 'Food' } }) as any)).toBeTrue();
  });

  it('supports raw array product API responses and ready-product fix actions', fakeAsync(() => {
    api.getVendorProducts.and.returnValue(of([product({ id: 'raw-product' })] as any));
    component.load();
    tick();

    expect(component.products()[0].id).toBe('raw-product');
    expect(component.total()).toBe(1);

    component.openFixes(product({ visibility_blockers: undefined }) as any);
    expect(toast.show).toHaveBeenCalledWith('This product is ready to sell.', 'success');

    component.fixesTarget.set(product() as any);
    component.closeFixes();
    expect(component.fixesTarget()).toBeNull();
  }));

  it('opens product fixes, submits approval, and updates the targeted row', fakeAsync(() => {
    const rejected = product({
      approval_status: 'rejected',
      rejection_reason: 'Needs better image',
      visibility_blockers: ['Missing image']
    });
    api.getVendorProducts.and.returnValue(of({ results: [rejected], count: 1 } as any));
    api.submitInheritedProducts.and.returnValue(of({ submitted: ['product-1'] } as any));

    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.health-action') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fixes-modal')?.textContent).toContain('Needs better image');

    (fixture.nativeElement.querySelector('.fixes-actions .btn-primary') as HTMLButtonElement).click();
    tick();
    fixture.detectChanges();

    expect(api.submitInheritedProducts).toHaveBeenCalledWith(['product-1']);
    expect(component.products()[0].approval_status).toBe('pending_approval');
    expect(component.fixesTarget()?.approval_status).toBe('pending_approval');
    expect(toast.show).toHaveBeenCalledWith('Product submitted for admin approval.', 'success');
  }));

  it('shows approval errors from the backend and ignores invalid submissions', fakeAsync(() => {
    component.submitForApproval(null);
    component.submitForApproval(product({ approval_status: 'approved' }) as any);
    expect(api.submitInheritedProducts).not.toHaveBeenCalled();

    const validDraft = product({ approval_status: 'draft' });
    api.submitInheritedProducts.and.returnValue(throwError(() => ({ error: { error: 'Already pending' } })));
    component.submitForApproval(validDraft as any);
    tick();

    expect(component.submittingApproval()).toBeNull();
    expect(toast.show).toHaveBeenCalledWith('Already pending', 'error');

    api.submitInheritedProducts.and.returnValue(throwError(() => ({ error: { error: { name: ['Required'] } } })));
    component.submitForApproval(validDraft as any);
    tick();
    expect(toast.show).toHaveBeenCalledWith('Fix product validation errors before submitting for approval.', 'error');
  }));

  it('merges returned approval variants while preserving untouched products', fakeAsync(() => {
    const target = product({ id: 'product-1', approval_status: 'draft' });
    const untouched = product({ id: 'product-2', name: 'Idli', approval_status: 'draft' });
    component.products.set([target as any, untouched as any]);
    component.fixesTarget.set(null);
    api.submitInheritedProducts.and.returnValue(of({
      variants: [
        { id: 'product-1', approval_status: 'pending_approval', approval_status_label: 'Queued', rejection_reason: '' }
      ]
    } as any));

    component.submitForApproval(target as any);
    tick();

    expect(component.products()[0].approval_status_label).toBe('Queued');
    expect(component.products()[1].name).toBe('Idli');
  }));

  it('confirms deletion, supports backdrop cancel, deletes through the API, and reloads', fakeAsync(() => {
    api.deleteProduct.and.returnValue(of({} as any));
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.danger-hover') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.delete-modal')?.textContent).toContain('Delete Product?');

    fixture.nativeElement.querySelector('.modal-backdrop').click();
    fixture.detectChanges();
    expect(component.deleteTarget()).toBeNull();

    component.confirmDelete(product() as any);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.btn-danger') as HTMLButtonElement).click();
    tick();

    expect(api.deleteProduct).toHaveBeenCalledWith('product-1');
    expect(toast.show).toHaveBeenCalledWith('"Masala Dosa" deleted.', 'success');
    expect(component.deleteTarget()).toBeNull();
  }));

  it('keeps the delete modal open and reports API errors when deletion fails', fakeAsync(() => {
    api.deleteProduct.and.returnValue(throwError(() => new Error('delete failed')));

    component.confirmDelete(product() as any);
    component.doDelete();
    tick();

    expect(component.deleting()).toBeFalse();
    expect(component.deleteTarget()?.id).toBe('product-1');
    expect(toast.show).toHaveBeenCalledWith('Failed to delete product.', 'error');
  }));

  it('does nothing when delete is requested without a selected product', () => {
    component.deleteTarget.set(null);
    component.doDelete();
    expect(api.deleteProduct).not.toHaveBeenCalled();
  });
});
