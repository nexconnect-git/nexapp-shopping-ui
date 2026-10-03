import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResponse, User } from '../models';
import { ApiCoreService } from './api-core.service';
import { AUTH_PREFIX } from '../tokens/auth-prefix.token';

@Injectable({ providedIn: 'root' })
export class AuthApi extends ApiCoreService {
  private readonly portal = inject(AUTH_PREFIX);
  login(data: { username: string; password: string }): Observable<AuthResponse> {
    return this.post<AuthResponse>('auth/login/', { ...data, portal: this.portal }, { withCredentials: true });
  }

  requestCustomerLoginOtp(data: { phone: string; email?: string }): Observable<unknown> {
    return this.post('auth/mobile/request-login-otp/', data);
  }

  verifyCustomerLoginOtp(data: {
    phone: string;
    otp: string;
    email?: string;
  }): Observable<AuthResponse> {
    return this.post<AuthResponse>('auth/mobile/verify-login-otp/', data, {
      withCredentials: true,
    });
  }

  register(data: unknown): Observable<AuthResponse> {
    return this.post<AuthResponse>('auth/register/', data, {
      withCredentials: true,
    });
  }

  requestCustomerRegisterOtp(data: { phone: string; email?: string }): Observable<unknown> {
    return this.post('auth/mobile/request-register-otp/', data);
  }

  verifyCustomerRegisterOtp(data: {
    phone: string;
    otp: string;
    first_name: string;
    last_name?: string;
    email?: string;
  }): Observable<AuthResponse> {
    return this.post<AuthResponse>('auth/mobile/verify-register-otp/', data, {
      withCredentials: true,
    });
  }

  refreshToken(): Observable<AuthResponse> {
    return this.post<AuthResponse>('auth/refresh/', { portal: this.portal }, { withCredentials: true });
  }

  logout(): Observable<unknown> {
    return this.post('auth/logout/', { portal: this.portal }, { withCredentials: true });
  }

  getProfile(): Observable<User> {
    return this.get<User>('auth/profile/');
  }

  registerDeviceToken(data: unknown): Observable<unknown> {
    return this.post('notifications/device-token/', data);
  }
}
