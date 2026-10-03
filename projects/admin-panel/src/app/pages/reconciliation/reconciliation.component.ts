import { RefundLedgerComponent } from '../../shared/refund-ledger.component';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  AppCurrencyPipe,
  FinanceConsole,
} from '@shared/public-api';
@Component({
  selector: 'app-reconciliation',
  standalone: true,
  imports: [RefundLedgerComponent, CommonModule, RouterLink, AppCurrencyPipe],
  templateUrl: './reconciliation.component.html',
  styleUrl: './reconciliation.component.scss',
})
export class ReconciliationComponent implements OnInit {
  private api = inject(ApiService);
  data = signal<FinanceConsole | null>(null);
  loading = signal(false);
  error = signal('');
  ngOnInit() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.getAdminFinanceSummary().subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load finance records.');
        this.loading.set(false);
      },
    });
  }
}
