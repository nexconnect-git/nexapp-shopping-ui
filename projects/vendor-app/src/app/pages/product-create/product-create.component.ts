import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VendorProductCreateComponent } from '../../shared/vendor-product-create/vendor-product-create.component';
import { VendorProductCreateService } from '../../shared/vendor-product-create/vendor-product-create.service';

@Component({
  selector: 'app-product-create',
  standalone: true,
  imports: [VendorProductCreateComponent],
  templateUrl: './product-create.component.html',
})
export class ProductCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(VendorProductCreateService);

  ngOnInit(): void {
    this.service.searchQuery.set(
      this.route.snapshot.queryParamMap.get('search') || ''
    );
    this.service.requestedCatalogId.set(
      this.route.snapshot.queryParamMap.get('catalog_id') || ''
    );
    void this.service.loadDrafts();
    void this.service.loadCatalogItems();
  }

  async cancel(): Promise<void> {
    void this.router.navigate(['/products']);
  }

  hasUnsavedChanges(): boolean {
    return this.service.dirty();
  }
  isSaving(): boolean {
    return this.service.saving();
  }
  submitted(): void {
    void this.router.navigate(['/products']);
  }
}
