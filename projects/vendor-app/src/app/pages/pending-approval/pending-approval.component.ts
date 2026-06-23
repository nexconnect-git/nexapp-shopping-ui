import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VendorApi, AuthService, SessionStore } from '@shared/public-api';

@Component({
  selector: 'app-pending-approval',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pending-approval.component.html',
  styleUrl: './pending-approval.component.scss',
})
export class PendingApprovalComponent implements OnInit, OnDestroy {
  private api = inject(VendorApi);
  private auth = inject(AuthService);
  private router = inject(Router);
  private session = inject(SessionStore);

  status = signal<string>('pending');
  statusReason = signal<string>('');
  storeName = signal<string>('');
  error = signal('');
  loading = signal(true);
  private pollInterval: any;

  ngOnInit() {
    this.checkStatus();
    this.pollInterval = setInterval(() => this.checkStatus(), 30000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  checkStatus() {
    this.api.getVendorProfile().subscribe({
      next: (profile) => {
        this.status.set(profile.status);
        this.statusReason.set(profile.status_reason || '');
        this.storeName.set(profile.store_name || '');
        this.error.set('');
        this.session.setVendorStatus(profile.status);
        this.loading.set(false);
        if (profile.status === 'approved') {
          clearInterval(this.pollInterval);
          this.router.navigate(['/']);
        } else if (
          [
            'rejected',
            'suspended',
            'invalid_details',
            'invalid_documents',
          ].includes(profile.status)
        ) {
          clearInterval(this.pollInterval);
        }
      },
      error: () => {
        this.error.set(
          'Could not check approval status. Please retry shortly.'
        );
        this.loading.set(false);
      },
    });
  }

  logout() {
    this.auth.logout();
  }

  get statusLabel(): string {
    const labels: Record<string, string> = {
      pending: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      hold: 'On Hold',
      suspended: 'Suspended',
      in_review: 'In Review',
      pending_details: 'Pending Details',
      pending_documents: 'Pending Documents',
      invalid_details: 'Invalid Details',
      invalid_documents: 'Invalid Documents',
    };
    return labels[this.status()] ?? this.status();
  }

  get statusMessage(): string {
    const messages: Record<string, string> = {
      pending:
        'Your store registration is under review. Our team will verify your details and get back to you shortly.',
      rejected:
        'Your application was not approved. Please contact support for more information.',
      hold: 'Your store registration is on hold while our team reviews the next action.',
      suspended:
        'Your vendor account has been suspended. Please contact support.',
      in_review:
        'Your store registration is actively being reviewed by our admin team.',
      pending_details:
        'Our team needs more details before approving your store.',
      pending_documents:
        'Our team needs additional or corrected documents before approval.',
      invalid_details:
        'Some submitted details could not be validated. Please contact support for next steps.',
      invalid_documents:
        'Some uploaded documents could not be validated. Please contact support for next steps.',
    };
    return messages[this.status()] ?? '';
  }
}
