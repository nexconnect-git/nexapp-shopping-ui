import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private api = inject(ApiService);

  email = '';
  loading = signal(false);
  sent = signal(false);
  error = signal('');

  submit() {
    const addr = this.email.trim();
    if (!addr) { this.error.set('Please enter your email address.'); return; }
    this.loading.set(true);
    this.error.set('');
    this.api.requestPasswordReset(addr).subscribe({
      next: () => { this.loading.set(false); this.sent.set(true); },
      error: () => { this.loading.set(false); this.sent.set(true); }, // always show success (no enumeration)
    });
  }
}
