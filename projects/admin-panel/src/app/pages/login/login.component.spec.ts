import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiService, AuthService } from '@shared/public-api';
import { LoginComponent } from './login.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('Admin LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let api: jasmine.SpyObj<ApiService>;
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  const authResponse = (role = 'admin', force_password_change = false) => ({
    user: { id: 'admin-1', username: 'admin', role, force_password_change },
    access: 'access',
    refresh: 'refresh'
  });

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['checkSetup']);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'handleAuthResponse']);
    api.checkSetup.and.returnValue(of({ needs_setup: false } as any));

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'setup', component: BlankComponent },
          { path: 'change-password', component: BlankComponent },
          { path: '', component: BlankComponent }
        ]),
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('checks setup state before showing the admin login form', fakeAsync(() => {
    const setup = new Subject<any>();
    api.checkSetup.and.returnValue(setup.asObservable());

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.checking-setup')?.textContent).toContain('Checking system status');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();

    setup.next({ needs_setup: false });
    setup.complete();
    tick();
    fixture.detectChanges();

    expect(component.checkingSetup()).toBeFalse();
    expect(fixture.nativeElement.querySelector('#username')?.getAttribute('autocomplete')).toBe('username');
    expect(fixture.nativeElement.querySelector('#password')?.getAttribute('autocomplete')).toBe('current-password');
  }));

  it('routes to setup when the backend reports an unconfigured system', fakeAsync(() => {
    api.checkSetup.and.returnValue(of({ needs_setup: true } as any));
    fixture.detectChanges();
    tick();

    expect(router.navigate).toHaveBeenCalledWith(['/setup']);
  }));

  it('still allows login if setup status check fails', fakeAsync(() => {
    api.checkSetup.and.returnValue(throwError(() => new Error('offline')));
    fixture.detectChanges();
    tick();

    expect(component.checkingSetup()).toBeFalse();
  }));

  it('validates required username and password before login', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.error-msg')?.textContent).toContain('Please fill in all fields.');
  }));

  it('logs in admins and navigates to the command center', fakeAsync(() => {
    auth.login.and.returnValue(of(authResponse() as any));
    fixture.detectChanges();
    tick();
    setInput('#username', 'admin');
    setInput('#password', 'secret');

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    tick();

    expect(auth.login).toHaveBeenCalledWith('admin', 'secret');
    expect(auth.handleAuthResponse).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(component.loading()).toBeFalse();
  }));

  it('routes forced password change admins to the password page', fakeAsync(() => {
    auth.login.and.returnValue(of(authResponse('admin', true) as any));
    fixture.detectChanges();
    tick();
    component.username = 'admin';
    component.password = 'secret';

    component.onLogin();
    tick();

    expect(router.navigate).toHaveBeenCalledWith(['/change-password']);
    expect(component.loading()).toBeFalse();
  }));

  it('rejects non-admin users without storing auth state', fakeAsync(() => {
    auth.login.and.returnValue(of(authResponse('vendor') as any));
    fixture.detectChanges();
    tick();
    component.username = 'vendor';
    component.password = 'secret';

    component.onLogin();
    tick();
    fixture.detectChanges();

    expect(auth.handleAuthResponse).not.toHaveBeenCalled();
    expect(component.loading()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.error-msg')?.textContent).toContain('Administrator privileges required');
  }));

  it('shows backend and fallback login errors while re-enabling the button', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.username = 'admin';
    component.password = 'bad';
    auth.login.and.returnValue(throwError(() => ({ error: { detail: 'Locked account' } })));

    component.onLogin();
    tick();
    expect(component.error()).toBe('Locked account');
    expect(component.loading()).toBeFalse();

    auth.login.and.returnValue(throwError(() => ({ error: {} })));
    component.onLogin();
    tick();
    expect(component.error()).toBe('Invalid credentials.');
  }));

  it('renders a disabled loading submit state', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    component.loading.set(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Signing in');
  }));

  function setInput(selector: string, value: string) {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
});
