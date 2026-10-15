import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
import { NxModalShellComponent } from '../ui/nx-modal-shell/nx-modal-shell.component';
import { CustomerStateComponent } from '../customer-state/customer-state.component';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UiService } from '../../services/ui.service';
import { AppStateService } from '../../services/app-state.service';
import {
  isValidEmail,
  isValidIndianPhone,
  normalizeIndianPhone,
  sanitizeDigits,
  sanitizeEmail,
} from '@shared/lib/utils/input-validation';

@Component({
  selector: 'fd-login-slider',
  standalone: true,
  imports: [FormsModule, NxModalShellComponent, CustomerIconComponent, CustomerStateComponent],
  templateUrl: './login-slider.component.html',
  styleUrls: ['./login-slider.component.scss'],
})
export class LoginSliderComponent {
  readonly verificationCompleted = signal(false);
  readonly now = signal(Date.now());
  readonly cooldown = computed(() => Math.max(0,Math.ceil((this.auth.otpResendAt() - this.now())/1000)));
  mobile = '';
  email = '';
  otp = '';
  fieldErrors = signal<{ mobile?: string; email?: string; otp?: string }>({});
  touched = signal<{ mobile?: boolean; email?: boolean; otp?: boolean }>({});
  submitted = signal(false);

  constructor(
    public ui: UiService,
    public auth: AuthService,
    public state: AppStateService
  ) {
    effect((onCleanup) => {
      if (this.ui.loginSliderOpen() && (this.auth.otpRequested() || this.auth.otpResendAt() > Date.now())) {
        this.now.set(Date.now());
        const timer=setInterval(() => this.now.set(Date.now()),1000);
        onCleanup(() => clearInterval(timer));
      }
    });
    effect(() => {
      if(!this.auth.isLoggedIn())this.verificationCompleted.set(false);
    });
  }
  finishSignIn():void {
    this.verificationCompleted.set(false);this.ui.closeLogin();
  }

  login(event: Event): void {
    event.preventDefault();
    if (this.auth.loading()) return;
    this.auth.error.set('');
    this.submitted.set(true);
    const errors = this.validate();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
      return;
    }

    const mobile = this.normalizedMobile();
    const email = this.email.trim();
    if (this.auth.otpRequested()) {
      this.auth.verifyOtp(mobile, this.otp.trim(), email, () => {
        this.state.retryProfile();
        this.verificationCompleted.set(true);
      });
    } else {
      this.auth.requestOtp(mobile, email, () =>
        this.state.showToast('OTP sent. Please enter the code to continue.')
      );
    }
  }

  updateMobile(value: string): void {
    const mobile=normalizeIndianPhone(value);
    if(mobile!==this.mobile)this.auth.otpResendAt.set(0);
    this.mobile = mobile;
    this.markTouched('mobile');
    this.clearFieldError('mobile');
  }

  updateEmail(value: string): void {
    const email=sanitizeEmail(value);
    if(email!==this.email)this.auth.otpResendAt.set(0);
    this.email = email;
    this.markTouched('email');
    this.clearFieldError('email');
  }

  updateOtp(value: string): void {
    this.otp = sanitizeDigits(value, 8);
    this.markTouched('otp');
    this.clearFieldError('otp');
  }

  changeDetails(): void {
    this.auth.otpRequested.set(false);
    this.otp = '';
    this.auth.error.set('');
    this.auth.errorCode.set('');
    this.fieldErrors.set({});
    this.touched.set({});
    this.submitted.set(false);
  }

  resendOtp(): void {
    if (!this.canResendOtp()) return;
    const errors = this.validate(false);
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length || this.auth.loading()) return;
    this.auth.requestOtp(this.normalizedMobile(), this.email.trim(), () =>
      this.state.showToast('OTP resent. Please check your email.')
    );
  }

  canSubmit(): boolean {
    return !this.auth.loading();
  }

  canResendOtp(): boolean {
    return (
      !this.auth.loading() && this.cooldown() === 0 && Object.keys(this.validate(false)).length === 0
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
    else if (!isValidIndianPhone(mobile))
      errors.mobile = 'Enter a valid mobile number.';

    if (!email) errors.email = 'Email is required.';
    else if (!isValidEmail(email))
      errors.email = 'Enter a valid email address.';

    if (includeOtp) {
      const otp = this.otp.trim();
      if (!otp) errors.otp = 'OTP is required.';
      else if (!/^\d{4,8}$/.test(otp)) errors.otp = 'Enter a valid OTP.';
    }
    return errors;
  }

  private normalizedMobile(): string {
    return normalizeIndianPhone(this.mobile);
  }

  private clearFieldError(field: 'mobile' | 'email' | 'otp'): void {
    const current = { ...this.fieldErrors() };
    delete current[field];
    this.fieldErrors.set(current);
    this.auth.error.set('');
    this.auth.errorCode.set('');
  }

  markTouched(field: 'mobile' | 'email' | 'otp'): void {
    this.touched.update((current) => ({ ...current, [field]: true }));
  }

  showFieldError(field: 'mobile' | 'email' | 'otp'): boolean {
    return (
      !!this.fieldErrors()[field] &&
      (!!this.touched()[field] || this.submitted())
    );
  }
}
