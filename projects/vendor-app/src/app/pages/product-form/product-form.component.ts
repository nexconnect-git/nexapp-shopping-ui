import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Category } from '@shared/public-api';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss'
})
export class ProductFormComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = signal(false);
  productId: string | null = null;
  categories = signal<Category[]>([]);
  saving = signal(false);
  errorMsg = signal('');
  successMsg = signal('');

  images = signal<any[]>([]);
  aiPrompt = signal('');
  generatingAi = signal(false);

  form: any = { name: '', description: '', price: null, compare_price: null, stock: 0, unit: 'pcs', sku: '', weight: '', category: null, is_available: true, is_featured: false };

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
            category: p.category?.id || null, is_available: p.is_available, is_featured: p.is_featured
          };
          this.loadImages();
        }
      });
    }
  }

  save() {
    this.saving.set(true);
    this.errorMsg.set('');
    const payload = { ...this.form };
    if (!payload.compare_price) delete payload.compare_price;
    if (!payload.category) delete payload.category;

    const req = this.isEdit()
      ? this.api.updateProduct(this.productId!, payload)
      : this.api.createProduct(payload);

    req.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.successMsg.set(this.isEdit() ? 'Product updated!' : 'Product created! You can now upload images.');
        if (!this.isEdit()) {
          this.productId = res.id;
          this.isEdit.set(true);
        } else {
          setTimeout(() => this.router.navigate(['/products']), 1200);
        }
      },
      error: (err) => {
        const e = err.error || {};
        this.errorMsg.set(typeof e === 'object' ? Object.values(e).flat().join(' ') : 'Save failed.');
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
      this.errorMsg.set('Please save the product first before uploading images.');
      return;
    }
    const file = event.target.files[0];
    if (file) {
      this.api.uploadProductImage(this.productId, file).subscribe({
        next: () => {
          this.loadImages();
          this.successMsg.set('Image uploaded successfully.');
        },
        error: (err) => this.errorMsg.set(err.error?.error || 'Upload failed.')
      });
    }
  }

  deleteImage(imgId: string) {
    if (!this.productId || !confirm('Delete this image?')) return;
    this.api.deleteProductImage(this.productId, imgId).subscribe({
      next: () => this.loadImages(),
      error: (err) => this.errorMsg.set('Failed to delete image.')
    });
  }

  generateAiImage() {
    if (!this.productId) {
      this.errorMsg.set('Please save the product first before generating images.');
      return;
    }
    if (!this.aiPrompt().trim()) {
      this.errorMsg.set('Please enter an AI prompt.');
      return;
    }
    this.generatingAi.set(true);
    this.api.generateProductAiImage({ product_id: this.productId, prompt: this.aiPrompt() }).subscribe({
      next: () => {
        this.generatingAi.set(false);
        this.aiPrompt.set('');
        this.loadImages();
        this.successMsg.set('AI Image generated successfully.');
      },
      error: (err) => {
        this.generatingAi.set(false);
        this.errorMsg.set(err.error?.error || 'AI generation failed.');
      }
    });
  }
}

