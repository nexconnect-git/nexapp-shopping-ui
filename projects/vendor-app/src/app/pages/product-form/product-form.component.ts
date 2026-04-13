import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, AppCurrencyPipe, Category, ToastService } from '@shared/public-api';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppCurrencyPipe],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss'
})
export class ProductFormComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = signal(false);
  productId: string | null = null;
  categories = signal<Category[]>([]);
  saving = signal(false);


  images = signal<any[]>([]);

  form: any = { name: '', description: '', price: null, compare_price: null, stock: 0, low_stock_threshold: 10, unit: 'pcs', sku: '', weight: '', category: null, is_available: true, status: 'active', is_featured: false };

  ngOnInit() {
    this.api.getCategories().subscribe({ next: (r) => this.categories.set(r.results || r) });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.productId = id;
      this.api.getProduct(this.productId).subscribe({
        next: (p) => {
          this.form = {
            name: p.name, description: p.description || '', price: p.price,
            compare_price: p.compare_price, stock: p.stock, unit: p.unit || 'pcs',
            sku: p.sku || '', weight: p.weight || '',
            category: p.category?.id || null, is_available: p.is_available, status: p.status || 'active', is_featured: p.is_featured,
            low_stock_threshold: p.low_stock_threshold ?? 10
          };
          this.loadImages();
        }
      });
    }
  }

  save() {
    this.saving.set(true);
    const payload = { ...this.form };
    if (!payload.compare_price) delete payload.compare_price;
    if (!payload.category) delete payload.category;

    const req = this.isEdit()
      ? this.api.updateProduct(this.productId!, payload)
      : this.api.createProduct(payload);

    req.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.show(this.isEdit() ? 'Product updated!' : 'Product created! You can now upload images.', 'success');
        if (!this.isEdit()) {
          this.productId = res.id;
          this.isEdit.set(true);
        } else {
          setTimeout(() => this.router.navigate(['/products']), 1200);
        }
      },
      error: (err) => {
        const e = err.error || {};
        this.toast.show(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Save failed.', 'error');
        this.saving.set(false);
      }
    });
  }

  loadImages() {
    if (!this.productId) return;
    this.api.getProductImages(this.productId).subscribe({
      next: (imgs) => this.images.set(imgs)
    });
  }

  onFileSelected(event: any) {
    if (!this.productId) {
      this.toast.show('Please save the product first before uploading images.', 'error');
      return;
    }
    if (this.images().length >= 5) {
      this.toast.show('Maximum 5 photos allowed per product.', 'error');
      return;
    }
    const file = event.target.files[0];
    if (file) {
      this.api.uploadProductImage(this.productId, file).subscribe({
        next: () => {
          this.loadImages();
          this.toast.show('Image uploaded successfully.', 'success');
        },
        error: (err) => this.toast.show(err.error?.error || 'Upload failed.', 'error')
      });
    }
  }

  deleteImage(imgId: string) {
    if (!this.productId || !confirm('Delete this image?')) return;
    this.api.deleteProductImage(this.productId, imgId).subscribe({
      next: () => this.loadImages(),
      error: () => this.toast.show('Failed to delete image.', 'error')
    });
  }


}

