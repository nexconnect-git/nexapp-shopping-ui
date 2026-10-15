import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { mapCustomerError } from '@nexconnect/customer-errors';
import { AuthService as SharedAuthService } from '@shared/lib/services/auth.service';
import { apiErrorMessage } from '@shared/lib/api/api-error';
import { type UserProfile } from '../models';
import { CustomerAccountApiService } from './customer-account-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sharedAuth = inject(SharedAuthService);
  private readonly accountApi = inject(CustomerAccountApiService);

  get sessionVersion(): number { return this.sharedAuth.sessionVersion; }

  private otpRequest = 0;
  private otpSession = this.sharedAuth.sessionVersion;
  constructor() {
    effect(() => {
      this.sharedAuth.user();
      if(this.otpSession !== this.sharedAuth.sessionVersion){
        this.otpSession = this.sharedAuth.sessionVersion;
        ++this.otpRequest;
        this.loading.set(false);
        this.otpRequested.set(false);
        this.error.set('');
        this.errorCode.set('');
      }
    });
  }
  readonly otpRequested = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly errorCode = signal('');
  readonly otpResendAt = signal(0);
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
    };
  });
  readonly isLoggedIn = computed(() => this.sharedAuth.isLoggedIn());

  requestOtp(
    phone: string,
    email = '',
    onDone?: () => void,
    onError?: (message: string) => void
  ): void {
    const request = ++this.otpRequest;
    const session = this.sharedAuth.sessionVersion;
    this.loading.set(true);
    this.error.set('');
    this.errorCode.set('');
    this.sharedAuth.requestCustomerLoginOtp(phone, email).subscribe({
      next: (response) => {
        if(request !== this.otpRequest || session !== this.sharedAuth.sessionVersion) return;
        const seconds = Number((response as any)?.resend_after_seconds);
        this.otpResendAt.set(Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : 0);
        this.otpRequested.set(true);
        this.loading.set(false);
        onDone?.();
      },
      error: (error) => {
        if(request !== this.otpRequest || session !== this.sharedAuth.sessionVersion) return;
        this.loading.set(false);
        this.errorCode.set(error?.error?.code || '');
        const retry = Number(error?.error?.retry_after_seconds);
        if(Number.isFinite(retry) && retry > 0) this.otpResendAt.set(Date.now() + retry * 1000);
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
    onError?: (message: string) => void
  ): void {
    const request = ++this.otpRequest;
    const session = this.sharedAuth.sessionVersion;
    this.loading.set(true);
    this.error.set('');
    this.errorCode.set('');
    this.sharedAuth.verifyCustomerLoginOtp(phone, otp, email).subscribe({
      next: (response) => {
        if(request !== this.otpRequest || session !== this.sharedAuth.sessionVersion) return;
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
        if(request !== this.otpRequest || session !== this.sharedAuth.sessionVersion) return;
        this.loading.set(false);
        this.errorCode.set(error?.error?.code || '');
        const retry = Number(error?.error?.retry_after_seconds);
        if(Number.isFinite(retry) && retry > 0) this.otpResendAt.set(Date.now() + retry * 1000);
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
    onError?: (message: string) => void
  ): void {
    const sessionVersion = this.sharedAuth.sessionVersion;
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
          if (sessionVersion !== this.sharedAuth.sessionVersion) return;
          this.sharedAuth.updateUserData(user);
          onDone?.();
        },
        error: (error) => {
          if (sessionVersion !== this.sharedAuth.sessionVersion) return;
          onError?.(this.explain(error, 'Could not update profile'));
        },
      });
  }

  private explain(error: any, fallback: string): string {
    const body = error?.error;
    if (String(body?.code || '').startsWith('otp_')) return body.error || fallback;
    const message = apiErrorMessage(error, fallback);
    if (/wait before requesting|too many.*request/i.test(message))
      return message;
    return mapCustomerError(body || error, apiErrorMessage(error, fallback))
      .message;
  }
}
