import { Component, HostListener, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiService } from '../../services/ui.service';
import { AuthService } from '../../services/auth.service';
import { AppStateService } from '../../services/app-state.service';
import { NxModalShellComponent } from '../ui/nx-modal-shell/nx-modal-shell.component';
import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
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
  imports: [FormsModule, NxModalShellComponent, CustomerIconComponent],
  templateUrl: './edit-modal.component.html',
  styleUrls: ['./edit-modal.component.scss'],
})
export class EditModalComponent {
  private auth = inject(AuthService);
  private state = inject(AppStateService);

  firstName = this.auth.currentUser()?.name?.trim().split(/\s+/)[0] || '';
  lastName = this.auth.currentUser()?.name?.trim().split(/\s+/).slice(1).join(' ') || '';
  get name():string {return [this.firstName,this.lastName].filter(Boolean).join(' ');}
  email = this.auth.currentUser()?.email || '';
  phone = this.auth.currentUser()?.phone || '';
  addressLabel = this.state.activeAddress()?.label || '';
  addressLine = this.state.activeAddress()?.line || '';
  paymentName = this.state.paymentMethods()[0]?.label || '';
  paymentId = 'Payment method';
  saving = signal(false);
  formError = signal('');
  fieldErrors = signal<Record<string, string>>({});

  private original = JSON.stringify([this.name, this.email, this.phone]);
  constructor(public ui: UiService) {
    effect(() => {
      if (this.ui.editModal() !== 'profile') return;
      untracked(() => {
        this.saving.set(false);
        const user = this.auth.currentUser();
        this.firstName = user?.name?.trim().split(/\s+/)[0] || '';
        this.lastName = user?.name?.trim().split(/\s+/).slice(1).join(' ') || '';
        this.email = user?.email || '';
        this.phone = user?.phone || '';
        this.original = JSON.stringify([this.name, this.email, this.phone]);
        this.formError.set('');
        this.fieldErrors.set({});
      });
    });
  }
  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (!(this.ui.editModal() === 'profile' && (this.saving() || this.original !== JSON.stringify([this.name, this.email, this.phone])))) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async close(): Promise<void> {
    if (this.saving()) return;
    if (
      this.original !== JSON.stringify([this.name, this.email, this.phone]) &&
      !(await this.ui.confirmDiscardDraft())
    )
      return;
    this.ui.closeEdit();
  }

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
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
        );
        return;
      }
      const session = this.auth.sessionVersion;
      const retryTrigger = event.currentTarget instanceof HTMLButtonElement
        ? event.currentTarget : document.querySelector<HTMLElement>('#profile-save');
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
          requestAnimationFrame(() => {
            if (session === this.auth.sessionVersion && this.ui.editModal() === 'profile' && retryTrigger?.isConnected) retryTrigger.focus();
          });
        }
      );
      return;
    }
    this.formError.set(
      'Manage addresses from the Addresses page. Payment choices are made at checkout.'
    );
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
    if (!stripControlCharacters(this.firstName))
      errors['firstName'] = 'First name is required.';
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
