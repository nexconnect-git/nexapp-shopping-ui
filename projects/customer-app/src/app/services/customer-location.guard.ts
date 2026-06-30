import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { buildCustomerLocationQuery } from '@nexconnect/customer-location';
import { LocationService } from '@shared/lib/services/location.service';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';
import { CustomerCatalogApiService } from './customer-catalog-api.service';

export const customerLocationGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const locations = inject(LocationService);
  const catalogApi = inject(CustomerCatalogApiService);
  const redirect = () =>
    router.createUrlTree(['/location'], {
      queryParams: { returnUrl: state.url || '/' },
    });

  const location = locations.location() || (await locations.initializeLocation(false));
  const params = buildCustomerLocationQuery({
    lat: location?.lat,
    lng: location?.lng,
    state: location?.state || '',
    city: location?.city || '',
    postal_code: location?.postalCode || '',
  });

  if (params['lat'] == null || params['lng'] == null) return redirect();

  try {
    const serviceability = await firstValueFrom(
      catalogApi.checkServiceability(params).pipe(
        timeout({ first: 1800 }),
        catchError(() => of({ is_serviceable: true })),
      ),
    );
    return serviceability?.is_serviceable !== false ? true : redirect();
  } catch {
    return true;
  }
};
