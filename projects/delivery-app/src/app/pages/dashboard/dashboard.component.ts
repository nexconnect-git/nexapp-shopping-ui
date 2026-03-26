import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, AuthService, DeliveryDashboard } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private api = inject(ApiService);

  stats = signal<DeliveryDashboard | null>(null);
  loading = signal(true);
  isAvailable = signal(false);
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 10000).subscribe(() => {
      this.api.getDeliveryDashboard().subscribe({
        next: (d) => { this.stats.set(d); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  toggleAvailability() {
    // Toggle availability via update location (keeps partner active)
    this.isAvailable.update(v => !v);
  }
}
