import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VendorProductEditComponent } from '../../shared/vendor-product-edit/vendor-product-edit.component';
import { VendorProductEditService } from '../../shared/vendor-product-edit/vendor-product-edit.service';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [VendorProductEditComponent],
  templateUrl: './product-edit.component.html',
})
export class ProductEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(VendorProductEditService);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.service.loadProduct(id);
  }

  cancel(): void {
    void this.router.navigate(['/products']);
  }
}
