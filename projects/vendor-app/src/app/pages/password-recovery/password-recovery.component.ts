import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  apiErrorMessage,
  AuthService,
  VendorWorkspaceApi,
} from '@shared/public-api';

@Component({
  selector: 'app-password-recovery',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './password-recovery.component.html',
  styleUrl: './password-recovery.component.scss',
})
export class PasswordRecoveryComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(VendorWorkspaceApi);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  readonly reset = this.route.snapshot.data['reset'] === true;
  readonly token = this.route.snapshot.queryParamMap.get('token') || '';
  email = '';
  password = '';
  confirm = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal(false);
  readonly message = signal('');
  readonly submitted = signal(false);
  submit(): void {
    if (this.loading()) return;
    this.submitted.set(true);
    this.error.set('');
    if (
      this.reset &&
      (this.password.length < 8 || this.password !== this.confirm)
    ) {
      this.error.set(
        'Enter matching passwords with at least eight characters.'
      );
      this.focusInvalid();
      return;
    }
    if (!this.reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.error.set('Enter a valid registered email.');
      this.focusInvalid();
      return;
    }
    this.loading.set(true);
    const request = this.reset
      ? this.api.resetPassword(this.token, this.password)
      : this.api.requestRecovery(this.email.trim());
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.success.set(true);
        this.message.set(result.detail);
        this.password = '';
        this.confirm = '';
        if (this.reset) this.auth.clearInvalidSession();
      },
      error: (error) => {
        this.error.set(
          apiErrorMessage(error, 'Request failed. Retry or request a new link.')
        );
        this.loading.set(false);
      },
    });
  }

  private focusInvalid(): void {
    afterNextRender(() => {
      this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, { injector: this.injector });
  }
}
