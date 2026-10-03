import { DestroyRef, inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '@shared/public-api';

import {
  applyListState,
  LIST_STATE_FIELDS,
  QUERY_FIELDS,
} from './admin-list-state';
export { applyListState } from './admin-list-state';

@Injectable({ providedIn: 'root' })
export class AdminListStateService {
  private router = inject(Router);
  private auth = inject(AuthService);
  private keys = new WeakMap<object, string>();
  private active?: Record<string, unknown>;
  private activePath = '';
  private previousUrl = '';
  constructor() {
    const preserveOnReload = () => { if (this.active) this.persist(this.active); };
    window.addEventListener('beforeunload', preserveOnReload);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', preserveOnReload));
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        ),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        if (
          !this.active ||
          event.urlAfterRedirects === this.previousUrl ||
          event.urlAfterRedirects.split('?')[0] !== this.activePath
        )
          return;
        const previous = this.router.parseUrl(this.previousUrl).queryParams;
        const next = this.router.parseUrl(event.urlAfterRedirects).queryParams;
        const values: Record<string, unknown> = {};
        for (const [query, fields] of Object.entries(QUERY_FIELDS)) {
          if (previous[query] === next[query]) continue;
          for (const field of fields)
            if (field in this.active) values[field] = String(next[query] ?? '');
        }
        if (Object.keys(values).length) {
          values['page'] = typeof this.active['page'] === 'number' ? 0 : 1;
          applyListState(this.active, values);
          for (const method of [
            'filter',
            'onFilterChange',
            'load',
            'loadPayouts',
          ]) {
            const reload = this.active[method];
            if (typeof reload === 'function') {
              reload.call(this.active);
              break;
            }
          }
        }
        this.previousUrl = event.urlAfterRedirects;
      });
  }
  activate(component: object) {
    const tree = this.router.parseUrl(this.router.url);
    const key = `nextou.admin.list.${this.auth.user()?.id}.${
      this.router.url.split('?')[0]
    }`;
    this.keys.set(component, key);
    const target = component as Record<string, unknown>;
    this.active = target;
    this.activePath = this.router.url.split('?')[0];
    this.previousUrl = this.router.url;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) applyListState(target, JSON.parse(raw));
    } catch {
      /* Invalid or unavailable storage must not block navigation. */
    }
    const overrides: Record<string, unknown> = {};
    for (const [query, fields] of Object.entries(QUERY_FIELDS)) {
      if (tree.queryParams[query] !== undefined)
        for (const field of fields)
          if (field in target)
            overrides[field] = String(tree.queryParams[query]);
    }
    if (Object.keys(overrides).length)
      overrides['page'] = typeof target['page'] === 'number' ? 0 : 1;
    applyListState(target, overrides);
  }
  deactivate(component: object) {
    this.persist(component);
    if (this.active === component) this.active = undefined;
  }
  private persist(component: object) {
    const key = this.keys.get(component);
    if (!key) return;
    const target = component as Record<string, unknown>;
    const state: Record<string, unknown> = {};
    for (const field of LIST_STATE_FIELDS) {
      const raw = target[field];
      const value =
        typeof raw === 'function' && 'set' in raw
          ? (raw as unknown as () => unknown)()
          : raw;
      if (typeof value === 'string' || typeof value === 'number')
        state[field] = value;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* Session storage may be disabled; navigation continues. */
    }
  }
}
