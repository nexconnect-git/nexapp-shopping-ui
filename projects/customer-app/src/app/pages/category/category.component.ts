import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomerIconComponent } from '../../shared/customer-icon/customer-icon.component';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriesComponent } from '../categories/categories.component';
import { CustomerPageHeaderComponent } from '../../shared/customer-page-header/customer-page-header.component';
import { CustomerStateComponent } from '../../shared/customer-state/customer-state.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
@Component({
  standalone: true,
  imports: [CustomerIconComponent, BreadcrumbsComponent,
    RouterLink,
    CustomerPageHeaderComponent,
    CustomerStateComponent,
    ProductCardComponent,
  ],
  templateUrl: '../categories/categories.component.html',
  styleUrls: ['../categories/categories.component.scss'],
})
export class CategoryComponent extends CategoriesComponent {}
