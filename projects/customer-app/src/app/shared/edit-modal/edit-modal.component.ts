import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiService } from '../../services/ui.service';
import { AuthService } from '../../services/auth.service';
import { AppStateService } from '../../services/app-state.service';
import {
  isValidEmail,
  isValidIndianPhone,
  normalizeIndianPhone,
  sanitizeEmail,
  stripControlCharacters,
} from '@shared/lib/utils/input-validation';

@Component({
  selector: 'fd-edit-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './edit-modal.component.html',
  styleUrls: ['./edit-modal.component.scss'],
})
export class EditModalComponent {
  private auth = inject(AuthService);
  private state = inject(AppStateService);

  name = this.auth.currentUser()?.name || '';
  email = this.auth.currentUser()?.email || '';
  phone = this.auth.currentUser()?.phone || '';
  addressLabel = this.state.activeAddress()?.label || '';
  addressLine = this.state.activeAddress()?.line || '';
  paymentName = this.state.paymentMethods()[0]?.label || '';
  paymentId = 'Payment method';
  saving = signal(false);
  formError = signal('');
  fieldErrors = signal<Record<string, string>>({});

  constructor(public ui: UiService) {}

  title(): string {
    if (this.ui.editModal() === 'profile') return 'Edit Profile';
    if (this.ui.editModal() === 'address') return 'Edit Address';
    if (this.ui.editModal() === 'payment') return 'Edit Payment Method';
    return 'Edit';
  }

  subtitle(): string {
    if (this.ui.editModal() === 'profile') return 'Nextou account';
    if (this.ui.editModal() === 'address') return 'Delivery details';
    if (this.ui.editModal() === 'payment') return 'Payment details';
    return 'Update details';
  }

  save(event: Event): void {
    event.preventDefault();
    if (this.ui.editModal() === 'profile') {
      const errors = this.validateProfile();
      this.fieldErrors.set(errors);
      if (Object.keys(errors).length) {
        this.formError.set('Please fix the highlighted profile fields.');
        return;
      }
      this.saving.set(true);
      this.formError.set('');
      this.auth.updateProfile(
        {
          name: stripControlCharacters(this.name),
          email: sanitizeEmail(this.email),
          phone: normalizeIndianPhone(this.phone),
        },
        () => {
          this.saving.set(false);
          this.state.showToast('Profile updated successfully');
          this.ui.closeEdit();
        },
        (message) => {
          this.saving.set(false);
          this.formError.set(message);
          this.state.showToast(message);
        },
      );
      return;
    }
    this.state.showToast('Changes saved successfully');
    this.ui.closeEdit();
  }

  onEmailInput(value: string): void {
    this.email = sanitizeEmail(value);
    this.clearFieldError('email');
  }

  onPhoneInput(value: string): void {
    this.phone = normalizeIndianPhone(value);
    this.clearFieldError('phone');
  }

  canSave(): boolean {
    if (this.saving()) return false;
    if (this.ui.editModal() === 'profile')
      return Object.keys(this.validateProfile()).length === 0;
    return true;
  }

  fieldError(field: string): string {
    return this.fieldErrors()[field] || '';
  }

  clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    this.formError.set('');
  }

  private validateProfile(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!stripControlCharacters(this.name))
      errors['name'] = 'Full name is required.';
    if (!sanitizeEmail(this.email)) errors['email'] = 'Email is required.';
    else if (!isValidEmail(this.email))
      errors['email'] = 'Enter a valid email address, e.g. name@example.com.';
    if (!normalizeIndianPhone(this.phone))
      errors['phone'] = 'Phone number is required.';
    else if (!isValidIndianPhone(this.phone))
      errors['phone'] = 'Enter a valid 10-digit Indian mobile number.';
    return errors;
  }
}
