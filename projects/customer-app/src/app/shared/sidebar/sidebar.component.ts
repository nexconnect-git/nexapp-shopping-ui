import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageFeatureAccessService } from '@shared/public-api';
import {
  categoryFilterKey,
  categoryMatchesFilterKey,
} from '@nexconnect/customer-core';
import { CatalogService } from '../../services/catalog.service';
import { AppStateService } from '../../services/app-state.service';
import { UiService } from '../../services/ui.service';
import { categoryIconFor } from '../category-icons';

type SidebarCategory = {
  id: string;
  label: string;
  raw?: {
    slug?: string | null;
  };
};

@Component({
  selector: 'fd-sidebar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  constructor(
    public catalog: CatalogService,
    public ui: UiService,
    public state: AppStateService,
    public features: PageFeatureAccessService,
    private router: Router,
  ) {}

  categoryQueryParams(category: SidebarCategory): Record<string, string> {
    if (category.id === 'all') return {};
    return { category: this.categoryKey(category) };
  }

  isCategoryActive(category: SidebarCategory): boolean {
    const tree = this.router.parseUrl(this.router.url);
    if (tree.root.children['primary']?.segments[0]?.path !== 'stores')
      return false;
    const activeCategory = this.normalize(
      tree.queryParams['category'] || 'all',
    );
    return categoryMatchesFilterKey(category as any, activeCategory);
  }

  isRouteActive(path: string): boolean {
    const tree = this.router.parseUrl(this.router.url);
    return (
      tree.root.children['primary']?.segments[0]?.path ===
      path.replace(/^\//, '')
    );
  }

  canUseRoute(path: string): boolean {
    return this.features.isRouteEnabled('customer-app', path);
  }

  categoryIcon(category: SidebarCategory): string {
    return categoryIconFor(category as any);
  }

  private categoryKey(category: SidebarCategory): string {
    return category.id === 'all' ? 'all' : categoryFilterKey(category as any);
  }

  private normalize(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
