import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-report.component.html',
  styleUrl: './sales-report.component.scss'
})
export class SalesReportComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  errorMsg = signal('');
  
  stats = signal<any>(null);
  dateRange = signal('30'); // days

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.api.getVendorDashboardStats({ days: this.dateRange() }).subscribe({
      next: (res) => {
        this.stats.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set('Failed to load sales report.');
        this.loading.set(false);
      }
    });
  }

  onRangeChange() {
    this.loadStats();
  }

  mathMax(a: number, b: number): number {
    return Math.max(a, b);
  }
}
