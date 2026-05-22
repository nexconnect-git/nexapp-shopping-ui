import { Component } from '@angular/core';
import { VendorProductCreateComponent } from '../../shared/vendor-product-create/vendor-product-create.component';

@Component({
  selector: 'nc-vendor-product-create-demo',
  standalone: true,
  imports: [VendorProductCreateComponent],
  templateUrl: './vendor-product-create-demo.component.html',
})
export class VendorProductCreateDemoComponent {}
