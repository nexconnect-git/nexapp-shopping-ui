import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, DashboardStats } from '@shared/public-api';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  stats = signal<DashboardStats | null>(null);
  loading = signal(true);
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 15000).subscribe(() => {
      this.api.getVendorDashboard().subscribe({
        next: (s) => { this.stats.set(s); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
