import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CUSTOMER_ICON_PATHS } from './customer-icon.paths';

@Component({
  selector: 'svg[customerIcon]',
  standalone: true,
  templateUrl: './customer-icon.component.html',
  styleUrl: './customer-icon.component.scss',
  host: { 'class': 'icon', 'viewBox': '0 0 24 24', 'aria-hidden': 'true' },
})
export class CustomerIconComponent {
  private readonly sanitizer = inject(DomSanitizer);
  drawing: SafeHtml = '';
  @Input() set customerIcon(name: string) {
    // Only compiled, local SVG paths enter this trusted markup; no API content.
    const aliases: Record<string,string> = {storefront:'store',shopping_bag:'bag',shopping_cart:'bag',location_on:'pin',notifications:'bell',receipt_long:'orders',hourglass_empty:'clock',explore_off:'search',error:'alert',warning:'alert',check_circle:'check',person:'user',local_shipping:'truck',help_outline:'help',support_agent:'help',privacy_tip:'shield'};
    this.drawing = this.sanitizer.bypassSecurityTrustHtml(CUSTOMER_ICON_PATHS[aliases[name] || name] || CUSTOMER_ICON_PATHS['grid']);
  }
}
