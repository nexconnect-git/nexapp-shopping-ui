import { distinctUntilChanged, Observable, of, switchMap, timer } from 'rxjs';

/** Cancel the previous request immediately, then debounce its replacement. */
export function adminSearchStream<T>(
  queries: Observable<string>,
  search: (query: string) => Observable<T>,
  empty: T
) {
  return queries.pipe(
    distinctUntilChanged(),
    switchMap((query) =>
      query.length >= 2
        ? timer(300).pipe(switchMap(() => search(query)))
        : of(empty)
    )
  );
}
