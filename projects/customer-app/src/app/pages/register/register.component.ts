import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@shared/public-api';
import { NxInputComponent, NxButtonComponent } from '../../design-system/index';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, NxInputComponent, NxButtonComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  form = { first_name: '', last_name: '', email: '', phone: '' };
  otp = '';
  otpRequested = signal(false);
  devOtp = signal('');
  loading = signal(false);
  error = signal('');
  info = signal('');

  requestOtp() {
    if (!this.form.first_name.trim() || !this.form.phone.trim()) {
      this.error.set('First name and mobile number are required.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.info.set('');
    this.auth.requestCustomerRegisterOtp(this.form.phone.trim(), this.form.email.trim()).subscribe({
      next: (res) => {
        this.otpRequested.set(true);
        this.devOtp.set(res.dev_otp || '');
        this.info.set(res.email_fallback_queued
          ? 'We sent a one-time code to your mobile number and email.'
          : 'We sent a one-time code to your mobile number.');
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Could not send OTP.');
        this.loading.set(false);
      }
    });
  }

  onRegister() {
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
    this.auth.verifyCustomerRegisterOtp({
      phone: this.form.phone.trim(),
      otp: this.otp.trim(),
      first_name: this.form.first_name.trim(),
      last_name: this.form.last_name.trim(),
      email: this.form.email.trim(),
    }).subscribe({
      next: (res) => {
        this.auth.handleAuthResponse(res);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Registration failed. Please try again.');
        this.loading.set(false);
      }
    });
  }

  editPhone() {
    this.otpRequested.set(false);
    this.otp = '';
    this.devOtp.set('');
    this.error.set('');
    this.info.set('');
  }
}


