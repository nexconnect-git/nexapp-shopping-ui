import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ApiService, AuthService, NotificationPollingService } from '@shared/public-api';
import { AppComponent } from './app.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('Admin AppComponent shell', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let api: jasmine.SpyObj<ApiService>;
  let auth: any;
  let polling: jasmine.SpyObj<NotificationPollingService>;
  let router: Router;
  let originalWidth: PropertyDescriptor | undefined;

  const userSignal = signal<any>({
    username: 'admin',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@nex.test'
  });

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getAdminNotifications',
      'markAllNotificationsRead',
      'markNotificationRead'
    ]);
    api.getAdminNotifications.and.returnValue(of({ results: [] } as any));
    api.markAllNotificationsRead.and.returnValue(of({} as any));
    api.markNotificationRead.and.returnValue(of({} as any));
    auth = {
      isLoggedIn: jasmine.createSpy('isLoggedIn').and.returnValue(true),
      isSuperUser: jasmine.createSpy('isSuperUser').and.returnValue(true),
      user: userSignal,
      logout: jasmine.createSpy('logout')
    };
    polling = jasmine.createSpyObj<NotificationPollingService>('NotificationPollingService', ['onUnreadChange', 'start']);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { path: '', component: BlankComponent },
          { path: 'orders/:id', component: BlankComponent },
          { path: 'delivery-partners/:id', component: BlankComponent },
          { path: 'notifications', component: BlankComponent },
          { path: 'vendors/onboard', component: BlankComponent }
        ]),
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: NotificationPollingService, useValue: polling },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    (component as any).setBreadcrumbs('/orders/12345678901234567890');
    originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  });

  afterEach(() => {
    fixture.destroy();
    if (originalWidth) {
      Object.defineProperty(window, 'innerWidth', originalWidth);
    }
  });

  it('starts notification polling, renders superuser navigation, and builds route breadcrumbs', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    (component as any).setBreadcrumbs('/orders/12345678901234567890');

    expect(polling.onUnreadChange).toHaveBeenCalled();
    expect(polling.start).toHaveBeenCalled();
    expect(component.breadcrumbs().map(c => c.label)).toEqual(['Command Center', 'Live Orders', 'Profile']);
    expect(component.pageTitle()).toBe('Profile');
    expect(fixture.nativeElement.textContent).toContain('Admin Access');
  }));

  it('maps polling notification actions for order, delivery, and generic notifications', fakeAsync(() => {
    fixture.detectChanges();
    const resolver = polling.start.calls.mostRecent().args[0] as (n: any) => { label: string; url: string };

    expect(resolver({ notification_type: 'order', related_entity_id: 'o1' })).toEqual({ label: 'View Order', url: '/orders/o1' });
    expect(resolver({ notification_type: 'delivery', related_entity_id: 'd1' })).toEqual({ label: 'View Partner', url: '/delivery-partners/d1' });
    expect(resolver({ notification_type: 'system' })).toEqual({ label: 'View', url: '/notifications' });
  }));

  it('toggles profile and notification dropdowns without bubbling document clicks', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const event = new Event('click');
    spyOn(event, 'stopPropagation');

    component.toggleProfile(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.profileOpen()).toBeTrue();
    expect(component.notifOpen()).toBeFalse();

    component.toggleNotif(event);
    expect(component.notifOpen()).toBeTrue();
    expect(component.profileOpen()).toBeFalse();
    expect(api.getAdminNotifications).toHaveBeenCalledWith({ page: 1, page_size: 8 });

    component.closeDropdowns();
    expect(component.notifOpen()).toBeFalse();
    expect(component.profileOpen()).toBeFalse();
  }));

  it('fetches notification loading, empty, success, and error states', fakeAsync(() => {
    api.getAdminNotifications.and.returnValue(of({ results: Array.from({ length: 10 }, (_, i) => ({ id: `n-${i}` })) } as any));
    component.fetchNotifications();
    tick();
    expect(component.notifications().length).toBe(8);
    expect(component.notifLoading()).toBeFalse();

    api.getAdminNotifications.and.returnValue(throwError(() => new Error('failed')));
    component.fetchNotifications();
    tick();
    expect(component.notifLoading()).toBeFalse();

    auth.isLoggedIn.and.returnValue(false);
    api.getAdminNotifications.calls.reset();
    component.fetchNotifications();
    expect(api.getAdminNotifications).not.toHaveBeenCalled();
  }));

  it('marks notifications read and handles read errors without breaking state', fakeAsync(() => {
    component.unreadCount.set(2);
    component.notifications.set([{ id: 'n1', is_read: false }, { id: 'n2', is_read: false }]);

    component.markAllRead();
    tick();
    expect(component.unreadCount()).toBe(0);
    expect(component.notifications().every(n => n.is_read)).toBeTrue();

    api.markAllNotificationsRead.and.returnValue(throwError(() => new Error('failed')));
    component.markAllRead();
    tick();
    expect(component.unreadCount()).toBe(0);
  }));

  it('handles notification clicks and navigation for order, delivery, and generic records', fakeAsync(() => {
    component.unreadCount.set(2);
    component.notifications.set([{ id: 'n1', is_read: false }, { id: 'n2', is_read: true }]);

    component.handleNotificationClick({ id: 'n1', is_read: false, notification_type: 'order', related_entity_id: 'o1' });
    tick();
    expect(api.markNotificationRead).toHaveBeenCalledWith('n1');
    expect(component.unreadCount()).toBe(1);
    expect(router.navigate).toHaveBeenCalledWith(['/orders', 'o1']);

    component.handleNotificationClick({ id: 'n2', is_read: true, notification_type: 'delivery', related_entity_id: 'd1' });
    expect(router.navigate).toHaveBeenCalledWith(['/delivery-partners', 'd1']);

    component.handleNotificationClick({ id: 'n3', is_read: true, notification_type: 'system' });
    expect(router.navigate).toHaveBeenCalledWith(['/notifications']);
  }));

  it('switches between desktop collapse and mobile menu behavior', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    component.toggleSidebar();
    expect(component.sidebarCollapsed()).toBeTrue();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    component.toggleSidebar();
    expect(component.mobileMenuOpen()).toBeTrue();
    component.closeMobileMenu();
    expect(component.mobileMenuOpen()).toBeFalse();
  });

  it('formats user initials, notification icons, breadcrumbs, and logout behavior', fakeAsync(() => {
    fixture.detectChanges();
    (component as any).setBreadcrumbs('/vendors/onboard?tab=store');
    expect(component.breadcrumbs().map(c => c.label)).toEqual(['Command Center', 'Stores', 'Onboarding']);

    expect(component.getInitials()).toBe('AL');
    userSignal.set({ username: 'root', email: 'root@nex.test' });
    expect(component.getInitials()).toBe('R');
    userSignal.set(null);
    expect(component.getInitials()).toBe('A');

    expect(component.notifIcon('promo')).toBe('local_offer');
    expect(component.notifIcon('unknown')).toBe('notifications');

    component.goToNotifications();
    expect(router.navigate).toHaveBeenCalledWith(['/notifications']);

    component.profileOpen.set(true);
    component.logout();
    expect(component.profileOpen()).toBeFalse();
    expect(auth.logout).toHaveBeenCalled();
  }));
});
