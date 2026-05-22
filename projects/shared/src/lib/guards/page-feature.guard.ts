import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import {
  ManagedAppId,
  PageFeatureAccessService,
} from '../services/page-feature-access.service';

export const pageFeatureGuard = (
  appId: ManagedAppId,
  pageId: string,
): CanActivateFn => {
  return () => {
    const access = inject(PageFeatureAccessService);
    const router = inject(Router);
    return access
      .loadConfig()
      .pipe(
        map(() =>
          access.isPageEnabled(appId, pageId)
            ? true
            : router.createUrlTree(['/feature-unavailable'], {
                queryParams: { app: appId, page: pageId },
              }),
        ),
      );
  };
};
