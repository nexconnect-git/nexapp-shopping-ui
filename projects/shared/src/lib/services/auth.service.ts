import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, defer, finalize, from, lastValueFrom, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthApi } from '../api/auth-api.service';
import { AuthResponse, User } from '../models';
import { AUTH_PREFIX } from '../tokens/auth-prefix.token';
import { CurrencyService } from './currency.service';
import { NativePlatformService } from './native-platform.service';
import { SessionStore } from './session-store.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly prefix = inject(AUTH_PREFIX);
  private readonly expectedRoleByPrefix: Record<string, User['role']> = {
    customer: 'customer',
    vendor: 'vendor',
    delivery: 'delivery',
    admin: 'admin',
  };
  private readonly currentUser = signal<User | null>(null);
  private readonly accessToken = signal<string | null>(null);
  private readonly session = inject(SessionStore);
  private refreshRequest$?: Observable<boolean>;
  private sessionGeneration=0;

  get sessionVersion():number{return this.sessionGeneration;}
  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(
    () => !!this.currentUser() && !!this.accessToken(),
  );

  get tokenKey() {
    return `${this.prefix}_access_token`;
  }
  get refreshTokenKey() {
    return `${this.prefix}_refresh_token`;
  }
  get userKey() {
    return `${this.prefix}_user`;
  }
  get refreshSessionKey() {
    return `${this.prefix}_refresh_session`;
  }
  get vendorKey() {
    return `${this.prefix}_vendor_status`;
  }

  private get expectedRole(): User['role'] | null {
    return this.expectedRoleByPrefix[this.prefix] || null;
  }

  private isPortalUser(user: User | null | undefined): boolean {
    if (!user) return false;
    if (!this.expectedRole) return true;
    return user.role === this.expectedRole;
  }

  constructor(
    private api: AuthApi,
    private router: Router,
    private currency: CurrencyService,
    private nativePlatform: NativePlatformService,
  ) {
    this.loadSession();
  }

  private loadSession() {
    this.session.migrateLegacySession();
    const token = this.session.getAccessToken();
    const userData = this.session.getUserRaw();

    if (token) {
      this.accessToken.set(token);
      this.session.setAccessToken(token);
    }

    if (token && !userData) {
      this.clearSession();
      return;
    }

    if (userData && token) {
      try {
        const user = JSON.parse(userData) as User;
        if (!this.isPortalUser(user)) {
          this.clearSession();
          return;
        }
        this.currentUser.set(user);
        this.currency.configureFromLocation(user);
        this.initializePushNotifications();
      } catch {
        this.session.clearUser();
      }
    }

    this.session.setRefreshToken(null);

    if (!token && (userData || this.session.hasRefreshSession())) {
      this.refreshAccessToken().subscribe({ error: () => { /* Keep the cookie session available for retry after an outage. */ } });
    }
  }

  private setAccessToken(token: string | null) {
    this.accessToken.set(token);
    this.session.setAccessToken(token);
  }

  getToken(): string | null {
    return this.accessToken();
  }

  getRefreshToken(): string | null {
    return this.session.getRefreshToken();
  }

  async setTokens(tokens: {
    access?: string | null;
    refresh?: string | null;
  }): Promise<void> {
    if (tokens.access !== undefined) this.setAccessToken(tokens.access);
    if (tokens.refresh !== undefined) {
      this.session.setRefreshToken(tokens.refresh);
    }
  }

  login(username: string, password: string) {
    return this.api.login({ username, password });
  }

  requestCustomerLoginOtp(phone: string, email?: string) {
    return this.api.requestCustomerLoginOtp({ phone, email: email || '' });
  }

  verifyCustomerLoginOtp(phone: string, otp: string, email?: string) {
    return this.api.verifyCustomerLoginOtp({ phone, otp, email: email || '' });
  }

  register(data: any) {
    return this.api.register(data);
  }

  requestCustomerRegisterOtp(phone: string, email?: string) {
    return this.api.requestCustomerRegisterOtp({ phone, email: email || '' });
  }

  verifyCustomerRegisterOtp(data: {
    phone: string;
    otp: string;
    first_name: string;
    last_name?: string;
    email?: string;
  }) {
    return this.api.verifyCustomerRegisterOtp(data);
  }

  handleAuthResponse(response: AuthResponse): boolean {
    if (!this.isPortalUser(response.user)) {
      this.clearSession();
      return false;
    }

    this.sessionGeneration++;
    this.setAccessToken(response.tokens.access);
    this.session.setUser(response.user);
    this.session.markRefreshSession();
    this.currentUser.set(response.user);
    this.currency.configureFromLocation(response.user);
    this.initializePushNotifications();
    return true;
  }

  refreshAccessToken(): Observable<boolean> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const generation=this.sessionGeneration;
    const tokenAtStart = this.getToken();
    const refresh = () => this.api.refreshToken().pipe(
      tap((response) => {
        if(generation!==this.sessionGeneration)throw new Error('Session changed during refresh.');
        const tokens = response.tokens || response;
        this.setAccessToken(tokens.access);
        this.session.setRefreshToken(tokens.refresh || null);
        this.session.markRefreshSession();
        if (response.user) {
          if (!this.isPortalUser(response.user as User)) {
            this.clearSession();
            throw new Error('Portal role mismatch');
          }
          this.session.setUser(response.user);
          this.currentUser.set(response.user);
          this.currency.configureFromLocation(response.user);
          this.initializePushNotifications();
        }
      }),
      map(() => true),
    );
    // The HttpOnly refresh cookie is shared by tabs and rotates once per request.
    // Serialize renewal, then reuse a valid access token renewed by another tab.
    this.refreshRequest$ = defer(() => {
      if (typeof navigator === 'undefined' || !navigator.locks) return refresh();
      return from(Promise.resolve(navigator.locks.request(`${this.prefix}-session-refresh`, async () => {
        if (generation !== this.sessionGeneration) return false;
        const shared = this.session.getSharedSession();
        const user = shared?.user as User | undefined;
        if (shared && shared.access !== tokenAtStart && user?.id === this.user()?.id && this.isPortalUser(user) && this.tokenIsCurrent(shared.access)) {
          this.setAccessToken(shared.access);
          return true;
        }
        return lastValueFrom(refresh());
      })));
    }).pipe(
      catchError((error) => {
        if (error?.status !== 400 && error?.status !== 401) return throwError(() => error);
        if (generation === this.sessionGeneration) this.clearSession();
        return of(false);
      }),
      finalize(() => {
        if (generation === this.sessionGeneration) this.refreshRequest$ = undefined;
      }),
      shareReplay(1),
    );

    return this.refreshRequest$;
  }

  private tokenIsCurrent(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 1000;
    } catch {
      return false;
    }
  }

  private initializePushNotifications() {
    const userId = this.currentUser()?.id;
    if (!userId || !this.accessToken()) return;
    void this.nativePlatform.registerForPushNotifications().then((registration) => {
      if (!registration || this.currentUser()?.id !== userId || !this.accessToken()) return;
      this.api.registerDeviceToken(registration).subscribe({ error: () => {} });
    }).catch(() => {});
  }

  private clearSession() {
    this.sessionGeneration++;
    this.refreshRequest$=undefined;
    this.session.clear();
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.currency.resetToDefault();
  }

  logout(redirectToLogin = true) {
    if (this.accessToken()) {
      this.api.logout().subscribe({ error: () => {} });
    }
    this.clearSession();
    if (redirectToLogin) {
      this.router.navigate(['/login']);
    }
  }

  clearInvalidSession() {
    this.clearSession();
  }

  getRole(): string {
    return this.currentUser()?.role || '';
  }

  isSuperUser(): boolean {
    return !!(this.currentUser() as any)?.is_superuser;
  }

  updateUserData(user: User) {
    if (!this.isPortalUser(user)) {
      this.clearSession();
      return;
    }
    this.session.setUser(user);
    this.currentUser.set(user);
    this.currency.configureFromLocation(user);
  }
}
