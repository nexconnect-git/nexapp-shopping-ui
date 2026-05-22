import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VendorProductCreateComponent } from '../../shared/vendor-product-create/vendor-product-create.component';
import { VendorProductCreateService } from '../../shared/vendor-product-create/vendor-product-create.service';

@Component({
  selector: 'app-product-create',
  standalone: true,
  imports: [VendorProductCreateComponent],
  templateUrl: './product-create.component.html',
})
export class ProductCreateComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly service = inject(VendorProductCreateService);

  ngOnInit(): void {
    this.service.reset();
    void this.service.loadCatalogItems();
  }

  async cancel(): Promise<void> {
    const canLeave = await this.service.discardDrafts();
    if (canLeave) void this.router.navigate(['/products']);
  }

  submitted(): void {
    void this.router.navigate(['/products']);
  }
}
