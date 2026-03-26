import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-pending-approval',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pending-approval.component.html',
  styleUrl: './pending-approval.component.scss'
})
export class PendingApprovalComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  status = signal<string>('pending');
  storeName = signal<string>('');
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
        this.storeName.set(profile.store_name || '');
        localStorage.setItem('vendor_status', profile.status);
        this.loading.set(false);
        if (profile.status === 'approved') {
          clearInterval(this.pollInterval);
          this.router.navigate(['/']);
        }
      },
      error: () => this.loading.set(false)
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
      suspended: 'Suspended',
    };
    return labels[this.status()] ?? this.status();
  }

  get statusMessage(): string {
    const messages: Record<string, string> = {
      pending: 'Your store registration is under review. Our team will verify your details and get back to you shortly.',
      rejected: 'Your application was not approved. Please contact support for more information.',
      suspended: 'Your vendor account has been suspended. Please contact support.',
    };
    return messages[this.status()] ?? '';
  }
}
