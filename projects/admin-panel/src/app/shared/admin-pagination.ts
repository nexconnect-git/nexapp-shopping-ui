import { defer, EMPTY, expand, Observable, reduce } from 'rxjs';

/** Read every page of a selector's API result, including records beyond page one. */
export function readAllAdminPages<T>(request: (page: number) => Observable<{ results: T[]; next?: string | null } | T[]>): Observable<T[]> {
  return defer(() => {
    let page = 1;
    return request(page).pipe(
      expand(response => !Array.isArray(response) && response.next ? request(++page) : EMPTY),
      reduce((rows, response) => [...rows, ...(Array.isArray(response) ? response : response.results)], [] as T[]),
    );
  });
}
