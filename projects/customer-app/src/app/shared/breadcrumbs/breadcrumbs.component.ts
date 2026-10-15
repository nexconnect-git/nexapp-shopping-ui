import { CustomerIconComponent } from '../customer-icon/customer-icon.component';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  link?: string | any[];
}

@Component({
  selector: 'fd-breadcrumbs',
  standalone: true,
  imports: [RouterLink,CustomerIconComponent],
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss'],
})
export class BreadcrumbsComponent {
  @Input() items: BreadcrumbItem[] = [];
}
