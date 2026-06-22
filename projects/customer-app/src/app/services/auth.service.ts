import { computed, inject, Injectable, signal } from '@angular/core';
import { mapCustomerError } from '@nexconnect/customer-errors';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { apiErrorMessage } from '@shared/lib/api/api-error';
import { type UserProfile } from '../models';
import { CustomerAccountApiService } from './customer-account-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sharedAuth = inject(SharedAuthService);
  private readonly accountApi = inject(CustomerAccountApiService);

  readonly otpRequested = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly currentUser = computed<UserProfile | null>(() => {
    const user = this.sharedAuth.user();
    if (!user) return null;
    const joined = (user as any).date_joined || (user as any).created_at || '';
    return {
      name:
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.username ||
        'Customer',
      email: user.email || '',
      phone: user.phone || '',
      memberSince: joined ? new Date(joined).toLocaleDateString() : '',
      ordersDelivered: 0,
      prime: false,
    };
  });
  readonly isLoggedIn = computed(() => this.sharedAuth.isLoggedIn());

  requestOtp(
    phone: string,
    email = '',
    onDone?: () => void,
    onError?: (message: string) => void,
  ): void {
    this.loading.set(true);
    this.error.set('');
    this.sharedAuth.requestCustomerLoginOtp(phone, email).subscribe({
      next: () => {
        this.otpRequested.set(true);
        this.loading.set(false);
        onDone?.();
      },
      error: (error) => {
        this.loading.set(false);
        const message = this.explain(error, 'Could not send OTP');
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  verifyOtp(
    phone: string,
    otp: string,
    email = '',
    onDone?: () => void,
    onError?: (message: string) => void,
  ): void {
    this.loading.set(true);
    this.error.set('');
    this.sharedAuth.verifyCustomerLoginOtp(phone, otp, email).subscribe({
      next: (response) => {
        if (!this.sharedAuth.handleAuthResponse(response)) {
          this.loading.set(false);
          this.error.set('This account is not allowed in the customer app.');
          onError?.('This account is not allowed in the customer app.');
          return;
        }
        this.loading.set(false);
        this.otpRequested.set(false);
        onDone?.();
      },
      error: (error) => {
        this.loading.set(false);
        const message = this.explain(error, 'Invalid OTP');
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  login(phone: string, otp: string, email = ''): void {
    if (otp?.trim()) this.verifyOtp(phone, otp, email);
    else this.requestOtp(phone, email);
  }

  logout(): void {
    this.sharedAuth.logout(false);
  }

  updateProfile(
    data: { name: string; email: string; phone: string },
    onDone?: () => void,
    onError?: (message: string) => void,
  ): void {
    const [firstName, ...rest] = data.name.trim().split(/\s+/).filter(Boolean);
    this.accountApi
      .updateProfile({
        first_name: firstName || data.name,
        last_name: rest.join(' '),
        email: data.email,
        phone: data.phone,
      })
      .subscribe({
        next: (user) => {
          this.sharedAuth.updateUserData(user);
          onDone?.();
        },
        error: (error) =>
          onError?.(this.explain(error, 'Could not update profile')),
      });
  }

  private explain(error: any, fallback: string): string {
    const body = error?.error;
    return mapCustomerError(
      body || error,
      apiErrorMessage(error, fallback)
    ).message;
  }
}
