import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
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

  stats = signal<any>(null);
  recentOrders = signal<any[]>([]);
  topVendors = signal<any[]>([]);
  loadingStats = signal(true);
  loadingOrders = signal(true);
  loadingVendors = signal(true);
  private sub?: Subscription;

  ngOnInit() {
    this.sub = timer(0, 30000).subscribe(() => {
      this.api.getAdminStats().subscribe({
        next: (s) => { this.stats.set(s); this.loadingStats.set(false); },
        error: () => this.loadingStats.set(false)
      });
      this.api.getOrders().subscribe({
        next: (r) => { this.recentOrders.set((r.results || r).slice(0, 5)); this.loadingOrders.set(false); },
        error: () => this.loadingOrders.set(false)
      });
      this.api.getVendors({ is_featured: true }).subscribe({
        next: (r) => { this.topVendors.set((r.results || r).slice(0, 5)); this.loadingVendors.set(false); },
        error: () => this.loadingVendors.set(false)
      });
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  starsFor(r: number) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
}
