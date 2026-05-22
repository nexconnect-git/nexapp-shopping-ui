import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import { NxButtonComponent } from '../ui/nx-button/nx-button.component';

@Component({
  selector: 'fd-login-slider',
  standalone: true,
  imports: [FormsModule, NxButtonComponent],
  templateUrl: './login-slider.component.html',
  styleUrls: ['./login-slider.component.scss'],
})
export class LoginSliderComponent {
  mobile = '';
  email = '';
  otp = '';
  fieldErrors = signal<{ mobile?: string; email?: string; otp?: string }>({});

  constructor(
    public ui: UiService,
    public auth: AuthService,
    private state: AppStateService,
  ) {
    effect(() => {
      if (this.auth.isLoggedIn() && this.ui.loginSliderOpen()) {
        this.ui.closeLogin();
        this.state.showToast('Signed in successfully');
      }
    });
  }

  login(event: Event): void {
    event.preventDefault();
    if (this.auth.loading()) return;
    this.auth.error.set('');
    const errors = this.validate();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      return;
    }

    const mobile = this.normalizedMobile();
    const email = this.email.trim();
    if (this.auth.otpRequested()) {
      this.auth.verifyOtp(mobile, this.otp.trim(), email);
    } else {
      this.auth.requestOtp(mobile, email, () =>
        this.state.showToast('OTP sent. Please enter the code to continue.'),
      );
    }
  }

  updateMobile(value: string): void {
    this.mobile = value;
    this.clearFieldError('mobile');
  }

  updateEmail(value: string): void {
    this.email = value;
    this.clearFieldError('email');
  }

  updateOtp(value: string): void {
    this.otp = value;
    this.clearFieldError('otp');
  }

  changeDetails(): void {
    this.auth.otpRequested.set(false);
    this.otp = '';
    this.auth.error.set('');
    this.fieldErrors.set({});
  }

  resendOtp(): void {
    const errors = this.validate(false);
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length || this.auth.loading()) return;
    this.auth.requestOtp(this.normalizedMobile(), this.email.trim(), () =>
      this.state.showToast('OTP resent. Please check your email.'),
    );
  }

  private validate(includeOtp = this.auth.otpRequested()): {
    mobile?: string;
    email?: string;
    otp?: string;
  } {
    const errors: { mobile?: string; email?: string; otp?: string } = {};
    const mobile = this.normalizedMobile();
    const email = this.email.trim();

    if (!mobile) errors.mobile = 'Mobile number is required.';
    else if (!/^[6-9]\d{9}$/.test(mobile))
      errors.mobile = 'Enter a valid mobile number.';

    if (!email) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = 'Enter a valid email address.';

    if (includeOtp) {
      const otp = this.otp.trim();
      if (!otp) errors.otp = 'OTP is required.';
      else if (!/^\d{4,8}$/.test(otp)) errors.otp = 'Enter a valid OTP.';
    }
    return errors;
  }

  private normalizedMobile(): string {
    return this.mobile.replace(/\D/g, '').slice(-10);
  }

  private clearFieldError(field: 'mobile' | 'email' | 'otp'): void {
    const current = { ...this.fieldErrors() };
    delete current[field];
    this.fieldErrors.set(current);
    this.auth.error.set('');
  }
}
