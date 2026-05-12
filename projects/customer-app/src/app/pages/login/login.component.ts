import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@shared/public-api';
import { NxInputComponent, NxButtonComponent } from '../../design-system/index';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, NxInputComponent, NxButtonComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  phone = '';
  otp = '';
  otpRequested = signal(false);
  devOtp = signal('');
  loading = signal(false);
  error = signal('');
  info = signal('');

  requestOtp() {
    if (!this.phone.trim()) {
      this.error.set('Please enter your mobile number.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.info.set('');
    this.auth.requestCustomerLoginOtp(this.phone.trim()).subscribe({
      next: (res) => {
        this.otpRequested.set(true);
        this.devOtp.set(res.dev_otp || '');
        this.info.set(res.email_fallback_queued
          ? 'We sent a one-time code to your mobile number and registered email.'
          : 'We sent a one-time code to your mobile number.');
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Could not send OTP.');
        this.loading.set(false);
      }
    });
  }

  onLogin() {
    if (!this.otpRequested()) {
      this.requestOtp();
      return;
    }
    if (!this.otp.trim()) {
      this.error.set('Please enter the OTP.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.info.set('');
    this.auth.verifyCustomerLoginOtp(this.phone.trim(), this.otp.trim()).subscribe({
      next: (res) => {
        if (res.user.role !== 'customer') {
          this.error.set('Access denied. This portal is strictly for customers.');
          this.loading.set(false);
          return;
        }
        this.auth.handleAuthResponse(res);
        this.router.navigate(['/']);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Invalid OTP.');
        this.loading.set(false);
      }
    });
  }

  editPhone() {
    this.otpRequested.set(false);
    this.otp = '';
    this.devOtp.set('');
    this.info.set('');
    this.error.set('');
  }
}


