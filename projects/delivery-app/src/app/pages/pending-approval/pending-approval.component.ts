import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, AuthService } from '@shared/public-api';

@Component({
  selector: 'app-pending-approval',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pending-approval.component.html',
  styleUrl: './pending-approval.component.scss',
})
export class PendingApprovalComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  auth = inject(AuthService);

  loading = signal(true);
  error = signal('');
  status = signal('offline');
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.checkStatus();
    this.pollInterval = setInterval(() => this.checkStatus(), 30000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  checkStatus() {
    this.api.getDeliveryDashboard().subscribe({
      next: (profile) => {
        this.status.set(profile?.partner_status || 'offline');
        this.loading.set(false);
        this.error.set('');
        if (profile?.is_approved) {
          this.router.navigate(['/']);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not check approval status. Please retry shortly.');
      },
    });
  }
}
