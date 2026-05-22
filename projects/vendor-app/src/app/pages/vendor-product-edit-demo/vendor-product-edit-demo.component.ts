import { Component } from '@angular/core';
import { VendorProductEditComponent } from '../../shared/vendor-product-edit/vendor-product-edit.component';

@Component({
  selector: 'nc-vendor-product-edit-demo',
  standalone: true,
  imports: [VendorProductEditComponent],
  templateUrl: './vendor-product-edit-demo.component.html',
})
export class VendorProductEditDemoComponent {}
