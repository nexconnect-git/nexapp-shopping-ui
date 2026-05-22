import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerContentConfigService } from '../../services/customer-content-config.service';

@Component({
  selector: 'fd-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  constructor(public content: CustomerContentConfigService) {}
}
