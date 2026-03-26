import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '@shared/public-api';
import { DynamicTableComponent, TableCellDirective } from '../../shared/components/dynamic-table/dynamic-table.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DynamicTableComponent, TableCellDirective],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  customers = signal<any[]>([]);
  loading = signal(true);
  saving = signal(false);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  search = '';
  verifiedFilter = '';
  error = signal('');
  private timer: any;

  tableColumns = [
    { key: 'name', label: 'Name', flex: '1.5fr' },
    { key: 'username', label: 'Username', flex: '1fr' },
    { key: 'email', label: 'Email', flex: '1.5fr' },
    { key: 'phone', label: 'Phone', flex: '1fr' },
    { key: 'verified', label: 'Verified', flex: '0.8fr' },
    { key: 'actions', label: 'Actions', flex: '1fr' }
  ];

  showModal = signal(false);
  editTarget = signal<any | null>(null);
  form = { first_name: '', last_name: '', email: '', phone: '', is_verified: false, is_active: true };

  ngOnInit() { this.load(); }

  goToProfile(c: any) { this.router.navigate(['/customers', c.id]); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page() };
    if (this.search) params.search = this.search;
    if (this.verifiedFilter) params.is_verified = this.verifiedFilter;
    this.api.getAdminCustomers(params).subscribe({
      next: (r) => {
        this.customers.set(r.results || r);
        this.total.set(r.count || (r.results || r).length);
        this.totalPages.set(Math.ceil((r.count || 0) / 20) || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch() { clearTimeout(this.timer); this.timer = setTimeout(() => { this.page.set(1); this.load(); }, 400); }
  setPage(p: number) { this.page.set(p); this.load(); }

  openEdit(c: any) {
    this.editTarget.set(c);
    this.form = {
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      is_verified: c.is_verified,
      is_active: c.is_active !== false,
    };
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.editTarget()) return;
    this.saving.set(true);
    this.error.set('');
    this.api.updateAdminCustomer(this.editTarget().id, this.form).subscribe({
      next: () => { this.saving.set(false); this.showModal.set(false); this.load(); },
      error: (err) => { this.saving.set(false); this.error.set(err.error?.detail || 'Update failed.'); }
    });
  }

  deleteCustomer(c: any) {
    if (!confirm(`Delete customer "${c.username}"? This is permanent.`)) return;
    this.api.deleteAdminCustomer(c.id).subscribe({ next: () => this.load() });
  }
}
