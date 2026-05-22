import { Component } from '@angular/core';
import {
  type ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '@shared/public-api';
import { VendorsComponent } from './vendors.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('Admin VendorsComponent', () => {
  let fixture: ComponentFixture<VendorsComponent>;
  let component: VendorsComponent;
  let api: jasmine.SpyObj<ApiService>;
  let confirmSpy: jasmine.Spy;

  const vendor = (overrides: Record<string, unknown> = {}) => ({
    id: 'vendor-1',
    store_name: 'Spice Hub',
    email: 'owner@spice.test',
    city: 'Bengaluru',
    status: 'pending',
    average_rating: 4.2,
    total_ratings: 11,
    min_order_amount: 250,
    ...overrides,
  });

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getAdminVendors',
      'setVendorStatus',
      'deleteAdminVendor',
      'createAdminVendor',
      'updateAdminVendor',
    ]);
    api.getAdminVendors.and.returnValue(
      of({ results: [vendor()], count: 1 } as any),
    );
    confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [VendorsComponent],
      providers: [
        provideRouter([
          { path: 'vendors/onboard', component: BlankComponent },
          { path: 'vendors/:id', component: BlankComponent },
          { path: 'vendors/:id/edit', component: BlankComponent },
        ]),
        { provide: ApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VendorsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('creates, loads vendors, and renders pending action controls', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(api.getAdminVendors).toHaveBeenCalledWith({ page: 1 });
    expect(fixture.nativeElement.textContent).toContain('Spice Hub');
    expect(fixture.nativeElement.querySelector('.approve')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.reject')).toBeTruthy();
  }));

  it('renders loading and empty states from API results', fakeAsync(() => {
    const pending = new Subject<any>();
    api.getAdminVendors.and.returnValue(pending.asObservable());
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
    ).toContain('No vendors found');
  }));

  it('handles raw array responses and load errors without trapping loading state', fakeAsync(() => {
    api.getAdminVendors.and.returnValue(
      of([vendor({ id: 'raw-vendor' })] as any),
    );
    component.load();
    tick();
    expect(component.vendors()[0].id).toBe('raw-vendor');
    expect(component.total()).toBe(1);

    api.getAdminVendors.and.returnValue(throwError(() => new Error('network')));
    component.load();
    tick();
    expect(component.loading()).toBeFalse();
  }));

  it('debounces search input, applies filters, reloads manually, and toggles auto refresh', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    api.getAdminVendors.calls.reset();

    const search = fixture.nativeElement.querySelector(
      '.toolbar-search input',
    ) as HTMLInputElement;
    search.value = 'spice';
    search.dispatchEvent(new Event('input'));
    tick(399);
    expect(api.getAdminVendors).not.toHaveBeenCalled();
    tick(1);
    expect(api.getAdminVendors).toHaveBeenCalledWith({
      page: 1,
      search: 'spice',
    });

    api.getAdminVendors.calls.reset();
    component.statusFilter = 'approved';
    component.load();
    expect(api.getAdminVendors).toHaveBeenCalledWith({
      page: 1,
      search: 'spice',
      status: 'approved',
    });

    component.page.set(3);
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('.admin-page-actions .btn-ghost')
      .click();
    expect(component.page()).toBe(1);

    fixture.nativeElement
      .querySelector('.admin-page-actions .btn-sm:not(.btn-ghost)')
      .click();
    expect(component.autoReload()).toBeFalse();
  }));

  it('paginates within bounds and ignores out-of-range requests', fakeAsync(() => {
    api.getAdminVendors.and.returnValue(
      of({ results: [vendor()], count: 45 } as any),
    );
    fixture.detectChanges();
    tick(0);
    api.getAdminVendors.calls.reset();

    component.changePage(2);
    expect(component.page()).toBe(2);
    expect(api.getAdminVendors).toHaveBeenCalledWith({ page: 2 });

    api.getAdminVendors.calls.reset();
    component.changePage(0);
    component.changePage(99);
    expect(api.getAdminVendors).not.toHaveBeenCalled();
  }));

  it('sets vendor status from action buttons and clears disabled state on errors', fakeAsync(() => {
    api.setVendorStatus.and.returnValue(of({} as any));
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.approve') as HTMLButtonElement
    ).click();
    tick();

    expect(api.setVendorStatus).toHaveBeenCalledWith('vendor-1', 'approved');
    expect(component.actionId()).toBeNull();

    api.setVendorStatus.and.returnValue(
      throwError(() => new Error('reject failed')),
    );
    component.setStatus(vendor() as any, 'rejected');
    tick();
    expect(component.actionId()).toBeNull();
  }));

  it('confirms before deleting vendors and reloads after deletion', fakeAsync(() => {
    api.deleteAdminVendor.and.returnValue(of({} as any));
    component.deleteVendor(vendor() as any);
    tick();
    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete vendor "Spice Hub"? This is permanent.',
    );
    expect(api.deleteAdminVendor).toHaveBeenCalledWith('vendor-1');

    confirmSpy.and.returnValue(false);
    api.deleteAdminVendor.calls.reset();
    component.deleteVendor(vendor() as any);
    expect(api.deleteAdminVendor).not.toHaveBeenCalled();
  }));

  it('opens create and edit modals, preserves form input, and closes cleanly', fakeAsync(() => {
    component.openCreate();
    fixture.detectChanges();
    expect(component.isCreating()).toBeTrue();
    expect(component.editModel().opening_time).toBe('09:00');
    expect(
      fixture.nativeElement.querySelector('.modal-content')?.textContent,
    ).toContain('Create New Vendor');

    component.closeModal();
    expect(component.showModal()).toBeFalse();
    expect(component.editModel()).toBeNull();

    component.openEdit(vendor({ status: 'approved' }) as any);
    fixture.detectChanges();
    expect(component.isCreating()).toBeFalse();
    expect(component.editModel().store_name).toBe('Spice Hub');
    component.editModel().store_name = 'Edited Hub';
    expect(vendor().store_name).toBe('Spice Hub');
  }));

  it('creates vendors, blocks duplicate saves while saving, and reports create errors', fakeAsync(() => {
    api.createAdminVendor.and.returnValue(of({} as any));
    component.openCreate();
    component.editModel().store_name = 'New Store';
    component.saveVendor();
    tick();

    expect(api.createAdminVendor).toHaveBeenCalledWith(
      jasmine.objectContaining({ store_name: 'New Store' }),
    );
    expect(component.showModal()).toBeFalse();

    component.openCreate();
    component.saving.set(true);
    api.createAdminVendor.calls.reset();
    component.saveVendor();
    expect(api.createAdminVendor).not.toHaveBeenCalled();

    component.saving.set(false);
    api.createAdminVendor.and.returnValue(
      throwError(() => ({ error: { username: ['Taken'] } })),
    );
    component.saveVendor();
    tick();
    expect(component.modalError()).toContain('username');
  }));

  it('updates vendors and ignores saves without a model or while already saving', fakeAsync(() => {
    api.updateAdminVendor.and.returnValue(of({} as any));
    component.openEdit(vendor({ id: 'vendor-9' }) as any);
    component.saveVendor();
    tick();
    expect(api.updateAdminVendor).toHaveBeenCalledWith(
      'vendor-9',
      jasmine.objectContaining({ id: 'vendor-9' }),
    );
    expect(component.showModal()).toBeFalse();

    api.updateAdminVendor.calls.reset();
    component.editModel.set(null);
    component.saveVendor();
    component.saving.set(true);
    component.editModel.set(vendor() as any);
    component.saveVendor();
    expect(api.updateAdminVendor).not.toHaveBeenCalled();

    component.saving.set(false);
    api.updateAdminVendor.and.returnValue(
      throwError(() => new Error('save failed')),
    );
    component.saveVendor();
    tick();
    expect(component.saving()).toBeFalse();
  }));

  it('formats vendor helper values deterministically', () => {
    expect(component.vendorColor('Spice Hub')).toMatch(/^#[0-9A-F]{6}$/);
    expect(component.starsFor(4.2)).toBe('★★★★☆');
  });
});
