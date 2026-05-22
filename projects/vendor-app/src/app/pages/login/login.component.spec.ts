import { Component } from '@angular/core';
import {
  type ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiService, AuthService } from '@shared/public-api';
import { LoginComponent } from './login.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let auth: jasmine.SpyObj<AuthService>;
  let api: jasmine.SpyObj<ApiService>;
  let router: Router;

  const vendorResponse = (overrides: Record<string, unknown> = {}) => ({
    user: {
      id: 'u-1',
      username: 'vendor',
      role: 'vendor',
      force_password_change: false,
      ...overrides,
    },
    access: 'access-token',
    refresh: 'refresh-token',
  });

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['login', 'handleAuthResponse'],
      {
        vendorKey: 'vendor_status',
      },
    );
    api = jasmine.createSpyObj<ApiService>('ApiService', ['getVendorProfile']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'register', component: BlankComponent },
          { path: 'change-password', component: BlankComponent },
          { path: 'pending-approval', component: BlankComponent },
          { path: '', component: BlankComponent },
        ]),
        { provide: AuthService, useValue: auth },
        { provide: ApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    localStorage.clear();
    fixture.detectChanges();
  });

  it('creates the login page with accessible username and password controls', () => {
    expect(component).toBeTruthy();
    expect(
      fixture.nativeElement
        .querySelector('#username')
        ?.getAttribute('autocomplete'),
    ).toBe('username');
    expect(
      fixture.nativeElement
        .querySelector('#password')
        ?.getAttribute('autocomplete'),
    ).toBe('current-password');
    expect(
      fixture.nativeElement.querySelector('button[type="submit"]')?.textContent,
    ).toContain('Sign In');
  });

  it('validates required credentials before calling the API', () => {
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('.error-msg')?.textContent,
    ).toContain('Please enter both username and password.');
  });

  it('submits entered credentials and routes approved vendors to the dashboard', fakeAsync(() => {
    auth.login.and.returnValue(of(vendorResponse() as any));
    api.getVendorProfile.and.returnValue(of({ status: 'approved' } as any));
    setInput('#username', 'merchant');
    setInput('#password', 'secret');

    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit'));
    tick();

    expect(auth.login).toHaveBeenCalledWith('merchant', 'secret');
    expect(auth.handleAuthResponse).toHaveBeenCalled();
    expect(localStorage.getItem('vendor_status')).toBe('approved');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(component.loading()).toBeFalse();
  }));

  it('routes approved vendors with forced password reset to change-password', fakeAsync(() => {
    auth.login.and.returnValue(
      of(vendorResponse({ force_password_change: true }) as any),
    );
    api.getVendorProfile.and.returnValue(of({ status: 'approved' } as any));
    component.username = 'merchant';
    component.password = 'secret';

    component.onLogin();
    tick();

    expect(router.navigate).toHaveBeenCalledWith(['/change-password']);
  }));

  it('routes pending vendors to the approval screen and stores status', fakeAsync(() => {
    auth.login.and.returnValue(of(vendorResponse() as any));
    api.getVendorProfile.and.returnValue(of({ status: 'pending' } as any));
    component.username = 'merchant';
    component.password = 'secret';

    component.onLogin();
    tick();

    expect(localStorage.getItem('vendor_status')).toBe('pending');
    expect(router.navigate).toHaveBeenCalledWith(['/pending-approval']);
  }));

  it('blocks non-vendor users without hydrating auth state', fakeAsync(() => {
    auth.login.and.returnValue(of(vendorResponse({ role: 'customer' }) as any));
    component.username = 'customer';
    component.password = 'secret';

    component.onLogin();
    tick();
    fixture.detectChanges();

    expect(auth.handleAuthResponse).not.toHaveBeenCalled();
    expect(api.getVendorProfile).not.toHaveBeenCalled();
    expect(component.loading()).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('.error-msg')?.textContent,
    ).toContain('strictly for vendors');
  }));

  it('falls back to pending approval if profile lookup fails after a vendor login', fakeAsync(() => {
    auth.login.and.returnValue(of(vendorResponse() as any));
    api.getVendorProfile.and.returnValue(
      throwError(() => new Error('profile unavailable')),
    );
    component.username = 'merchant';
    component.password = 'secret';

    component.onLogin();
    tick();

    expect(router.navigate).toHaveBeenCalledWith(['/pending-approval']);
    expect(component.loading()).toBeFalse();
  }));

  it('shows API error detail and re-enables the submit button on login failure', fakeAsync(() => {
    auth.login.and.returnValue(
      throwError(() => ({ error: { detail: 'Invalid password' } })),
    );
    component.username = 'merchant';
    component.password = 'bad';

    component.onLogin();
    tick();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.error-msg')?.textContent,
    ).toContain('Invalid password');
    expect(
      fixture.nativeElement.querySelector('button[type="submit"]').disabled,
    ).toBeFalse();
  }));

  it('falls back through supported login error shapes', fakeAsync(() => {
    auth.login.and.returnValue(
      throwError(() => ({ error: { error: 'Account disabled' } })),
    );
    component.username = 'merchant';
    component.password = 'bad';

    component.onLogin();
    tick();
    expect(component.error()).toBe('Account disabled');

    auth.login.and.returnValue(throwError(() => ({ error: {} })));
    component.onLogin();
    tick();
    expect(component.error()).toBe('Invalid credentials. Please try again.');
  }));

  it('renders the loading interaction state while authentication is pending', fakeAsync(() => {
    auth.login.and.returnValue(of(vendorResponse() as any));
    api.getVendorProfile.and.returnValue(of({ status: 'approved' } as any));
    component.username = 'merchant';
    component.password = 'secret';
    component.loading.set(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Signing in');
  }));

  function setInput(selector: string, value: string) {
    const input = fixture.nativeElement.querySelector(
      selector,
    ) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
});
