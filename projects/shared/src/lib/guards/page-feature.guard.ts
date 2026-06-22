import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import {
  ManagedAppId,
  PageFeatureFailMode,
  PageFeatureAccessService,
} from '../services/page-feature-access.service';

export interface PageFeatureGuardOptions {
  critical?: boolean;
  failMode?: PageFeatureFailMode;
}

export const pageFeatureGuard = (
  appId: ManagedAppId,
  pageId: string,
  options: PageFeatureGuardOptions = {},
): CanActivateFn => {
  return () => {
    if (options.critical) return true;

    const access = inject(PageFeatureAccessService);
    const router = inject(Router);
    return access
      .loadConfig()
      .pipe(
        map(() =>
          access.isPageEnabled(appId, pageId, options.failMode || 'open')
            ? true
            : router.createUrlTree(['/feature-unavailable'], {
                queryParams: { app: appId, page: pageId },
              }),
        ),
      );
  };
};
