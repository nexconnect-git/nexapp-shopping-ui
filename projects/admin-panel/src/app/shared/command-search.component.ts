import {
  Component,
  HostListener,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { catchError, of, Subject, Subscription } from 'rxjs';
import { ApiService } from '@shared/public-api';
import { AdminSearchResult } from '@shared/lib/models/admin-console';
import {
  ADMIN_BASE_NAV_SECTIONS,
  ADMIN_GOVERN_NAV_ITEMS,
} from '../config/admin-navigation';
import { AdminAccessService } from '../services/admin-access.service';
import { adminSearchStream } from '../services/admin-search-stream';

@Component({
  selector: 'app-command-search',
  standalone: true,
  imports: [RouterLink, DialogModule],
  templateUrl: './command-search.component.html',
  styleUrl: './command-search.component.scss',
})
export class CommandSearchComponent implements OnDestroy {
  private api = inject(ApiService);
  private access = inject(AdminAccessService);
  private router = inject(Router);
  visible = false;
  query = signal('');
  results = signal<AdminSearchResult[]>([]);
  busy = signal(false);
  error = signal('');
  private queries = new Subject<string>();
  private subscription: Subscription = adminSearchStream<{
    results: AdminSearchResult[];
  }>(
    this.queries,
    (query) => {
      this.error.set('');
      this.busy.set(query.length >= 2);
      return this.api.searchAdmin(query).pipe(
        catchError(() => {
          this.error.set(
            'Record search is unavailable. Page matches are still available.'
          );
          return of({ results: [] });
        })
      );
    },
    { results: [] }
  ).subscribe((response) => {
    this.results.set([...this.pageResults(), ...response.results]);
    this.busy.set(false);
  });
  private pageResults(): AdminSearchResult[] {
    const query = this.query().toLowerCase();
    const sections = [
      ...ADMIN_BASE_NAV_SECTIONS,
      {
        label: 'Administration',
        items: [
          ...ADMIN_GOVERN_NAV_ITEMS,
          {
            route: '/admin-users',
            label: 'Admin users',
            icon: 'admin_panel_settings',
          },
          { route: '/permissions', label: 'Permissions', icon: 'lock' },
        ],
      },
    ];
    return sections
      .flatMap((section) =>
        section.items
          .filter(
            (item) =>
              this.access.canRoute(item.route) &&
              item.label.toLowerCase().includes(query)
          )
          .map((item) => ({
            group: 'Pages',
            label: item.label,
            detail: section.label,
            route: item.route,
          }))
      )
      .slice(0, 8);
  }
  open() {
    this.visible = true;
    this.results.set(this.pageResults());
    setTimeout(() => document.getElementById('workspace-search')?.focus());
  }
  close() {
    this.visible = false;
    this.search('');
  }
  search(value: string) {
    this.query.set(value.trim());
    this.busy.set(this.query().length >= 2);
    this.error.set('');
    this.results.set(this.pageResults());
    this.queries.next(this.query());
  }
  openFirst() {
    const result = this.results()[0];
    if (result) {
      this.router.navigateByUrl(result.route);
      this.close();
    }
  }
  @HostListener('document:keydown', ['$event']) onKey(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.open();
    }
    if (event.key === 'Escape') this.close();
  }
  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
