import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@shared/public-api';

@Component({
  selector: 'app-stock-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-management.component.html',
  styleUrl: './stock-management.component.scss'
})
export class StockManagementComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  errorMsg = signal('');
  
  products = signal<any[]>([]);
  lowStockAlerts = signal<any[]>([]);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    
    // Load all products to manage stock
    this.api.getVendorProducts().subscribe({
      next: (res) => {
        const prods = (res.results || res).map((p: any) => ({
          ...p,
          _editing: false,
          _newStock: p.stock,
          _newThreshold: p.low_stock_threshold
        }));
        this.products.set(prods);
        
        // After loading all, also load low stock alerts specifically
        this.loadLowStock();
      },
      error: () => {
        this.errorMsg.set('Failed to load products for stock management.');
        this.loading.set(false);
      }
    });
  }

  loadLowStock() {
    this.api.getLowStockProducts().subscribe({
      next: (res) => {
        this.lowStockAlerts.set(res.results || res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  toggleEdit(prod: any) {
    prod._editing = !prod._editing;
    if (prod._editing) {
      prod._newStock = prod.stock;
      prod._newThreshold = prod.low_stock_threshold;
    }
  }

  saveStock(prod: any) {
    const payload = {
      stock: prod._newStock,
      low_stock_threshold: prod._newThreshold
    };
    
    this.api.updateProductStock(prod.id, payload).subscribe({
      next: (updatedProd) => {
        prod.stock = updatedProd.stock;
        prod.low_stock_threshold = updatedProd.low_stock_threshold;
        prod._editing = false;
        
        // Refresh low stock alerts
        this.loadLowStock();
      },
      error: () => alert('Failed to update stock.')
    });
  }
}
