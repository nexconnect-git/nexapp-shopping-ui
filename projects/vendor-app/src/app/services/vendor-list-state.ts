import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiErrorMessage, VendorPaged, VendorQuery } from '@shared/public-api';
import { Observable } from 'rxjs';
export function vendorListState<T, R extends VendorPaged<T> = VendorPaged<T>>(
  request: (query: VendorQuery) => Observable<R>
) {
  const destroy = inject(DestroyRef),
    rows = signal<T[]>([]),
    loading = signal(false),
    error = signal(''),
    page = signal(1),
    count = signal(0),
    response = signal<R | null>(null);
  let generation = 0;
  let lastQuery: VendorQuery = {};
  function load(query: VendorQuery = {}): void {
    lastQuery = query;
    const current = ++generation;
    loading.set(true);
    error.set('');
    request({ ...query, page: page() })
      .pipe(takeUntilDestroyed(destroy))
      .subscribe({
        next: (result) => {
          if (current !== generation) return;
          rows.set(result.results);
          count.set(result.count);
          response.set(result);
          loading.set(false);
        },
        error: (failure) => {
          if (current === generation) {
            error.set(
              apiErrorMessage(failure, 'Could not load this list. Retry.')
            );
            loading.set(false);
          }
        },
      });
  }
  return {
    rows,
    loading,
    error,
    page,
    count,
    response,
    load,
    reload: () => load(lastQuery),
  };
}
