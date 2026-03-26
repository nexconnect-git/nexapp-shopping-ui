import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { User, AuthResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser = signal<User | null>(null);
  user = this.currentUser.asReadonly();
  isLoggedIn = computed(() => !!this.currentUser());

  constructor(private api: ApiService, private router: Router) {
    this.loadUser();
  }

  private loadUser() {
    const userData = localStorage.getItem('user');
    if (userData) {
      this.currentUser.set(JSON.parse(userData));
    }
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  login(username: string, password: string) {
    return this.api.login({ username, password });
  }

  register(data: any) {
    return this.api.register(data);
  }

  handleAuthResponse(response: AuthResponse) {
    localStorage.setItem('access_token', response.tokens.access);
    localStorage.setItem('refresh_token', response.tokens.refresh);
    localStorage.setItem('user', JSON.stringify(response.user));
    this.currentUser.set(response.user);

    // Register FCM device token
    this.registerPushNotifications();
  }

  private registerPushNotifications() {
    // In a real app, this would use Firebase Cloud Messaging SDK
    const mockFcmToken = 'fcm-web-token-' + Math.random().toString(36).substring(2, 10);
    this.api.registerDeviceToken({ token: mockFcmToken, platform: 'web' }).subscribe({
      next: () => console.log('✅ FCM Device Token registered for Push Notifications'),
      error: (err) => console.warn('Failed to register FCM token', err)
    });
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('vendor_status');
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
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUser.set(user);
  }
}
