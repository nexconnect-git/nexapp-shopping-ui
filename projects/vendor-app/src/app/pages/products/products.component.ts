import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Product } from '@shared/public-api';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  private api = inject(ApiService);
  products = signal<Product[]>([]);
  loading = signal(true);

  ngOnInit() { this.load(); }

  load() {
    this.api.getVendorProducts().subscribe({
      next: (r) => { this.products.set(r.results || r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  deleteProduct(product: Product) {
    if (!confirm(`Delete "${product.name}"?`)) return;
    this.api.deleteProduct(product.id).subscribe({ next: () => this.load() });
  }
}
