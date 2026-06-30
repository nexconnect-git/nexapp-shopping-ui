import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { buildCustomerLocationQuery } from '@nexconnect/customer-location';
import { LocationService } from '@shared/lib/services/location.service';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';
import { CustomerCatalogApiService } from './customer-catalog-api.service';
import { CatalogService } from './catalog.service';
import { AppStateService } from './app-state.service';

export const customerLocationGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const locations = inject(LocationService);
  const catalogApi = inject(CustomerCatalogApiService);
  const catalog = inject(CatalogService);
  const appState = inject(AppStateService);
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
    appState.serviceability.set(serviceability as any);
    const message = String((serviceability as any)?.message || '').toLowerCase();
    const deliveryUnavailable =
      serviceability?.is_serviceable === false ||
      message.includes('delivery is no longer available') ||
      message.includes('please refresh availability') ||
      message.includes('choose your location again');
    if (deliveryUnavailable) catalog.clearDeliverableCatalog();
    return true;
  } catch {
    return true;
  }
};
