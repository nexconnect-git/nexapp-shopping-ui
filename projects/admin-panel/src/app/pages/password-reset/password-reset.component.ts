import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
export class PasswordResetComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  confirm = this.route.snapshot.routeConfig?.path === 'reset-password';
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  email = '';
  password = '';
  confirmation = '';
  busy = signal(false);
  message = signal('');
  error = signal('');
  complete = signal(false);
  submit() {
    if (this.busy()) return;
    if (this.confirm && (!this.token || this.password !== this.confirmation)) {
      this.error.set('Use a valid reset link and matching passwords.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const operation = this.confirm
      ? this.api.confirmPasswordReset(this.token, this.password)
      : this.api.requestPasswordReset(this.email, 'admin');
    operation.subscribe({
      next: (response) => {
        this.message.set(
          response.detail ||
            (this.confirm
              ? 'Password updated. Sign in with your new password.'
              : 'If an eligible account exists, its reset link has been sent.')
        );
        this.complete.set(true);
        this.password = '';
        this.confirmation = '';
        this.busy.set(false);
      },
      error: (error) => {
        this.error.set(
          error.error?.new_password?.join?.(' ') ||
            error.error?.detail ||
            'Could not complete the request. Check the link or try again.'
        );
        this.busy.set(false);
      },
    });
  }
}
