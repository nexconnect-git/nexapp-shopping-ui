import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { User, AuthResponse } from '../models';
import { AUTH_PREFIX } from '../tokens/auth-prefix.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private prefix = inject(AUTH_PREFIX);
  private currentUser = signal<User | null>(null);
  user = this.currentUser.asReadonly();
  isLoggedIn = computed(() => !!this.currentUser());

  // Scoped storage keys — isolated per portal
  get tokenKey()   { return `${this.prefix}_access_token`; }
  get refreshKey() { return `${this.prefix}_refresh_token`; }
  get userKey()    { return `${this.prefix}_user`; }
  get vendorKey()  { return `${this.prefix}_vendor_status`; }

  constructor(private api: ApiService, private router: Router) {
    this.loadUser();
  }

  private loadUser() {
    const userData = localStorage.getItem(this.userKey);
    if (userData) {
      try {
        this.currentUser.set(JSON.parse(userData));
      } catch {
        localStorage.removeItem(this.userKey);
      }
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  login(username: string, password: string) {
    return this.api.login({ username, password });
  }

  register(data: any) {
    return this.api.register(data);
  }

  handleAuthResponse(response: AuthResponse) {
    localStorage.setItem(this.tokenKey, response.tokens.access);
    localStorage.setItem(this.refreshKey, response.tokens.refresh);
    localStorage.setItem(this.userKey, JSON.stringify(response.user));
    this.currentUser.set(response.user);
    this.registerPushNotifications();
  }

  private registerPushNotifications() {
    const mockFcmToken = 'fcm-web-token-' + Math.random().toString(36).substring(2, 10);
    this.api.registerDeviceToken({ token: mockFcmToken, platform: 'web' }).subscribe({
      next: () => console.log('✅ FCM Device Token registered for Push Notifications'),
      error: (err) => console.warn('Failed to register FCM token', err)
    });
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.vendorKey);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getRole(): string {
    return this.currentUser()?.role || '';
  }

  isSuperUser(): boolean {
    return !!(this.currentUser() as any)?.is_superuser;
  }

  updateUserData(user: User) {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.currentUser.set(user);
  }
}
