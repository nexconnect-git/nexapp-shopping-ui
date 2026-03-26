import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-earnings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './earnings.component.html',
  styleUrls: ['./earnings.component.scss']
})
export class EarningsComponent implements OnInit {
  private api = inject(ApiService);
  earnings = signal<any[]>([]);
  loading = signal(true);
  totalEarnings = signal(0);
  monthEarnings = signal(0);

  ngOnInit() {
    this.api.getDeliveryEarnings().subscribe({
      next: (r) => {
        const list = r.results || r;
        this.earnings.set(list);
        this.totalEarnings.set(list.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0));
        const now = new Date();
        const monthList = list.filter((e: any) => {
          const d = new Date(e.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        this.monthEarnings.set(monthList.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
