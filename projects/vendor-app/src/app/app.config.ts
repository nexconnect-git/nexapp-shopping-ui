import {
  type ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  API_BASE_URL,
  AUTH_PREFIX,
  authInterceptor,
  cacheInterceptor,
} from '@shared/public-api';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { providePrimeNG } from 'primeng/config';
import { CounterTheme } from './counter-theme';

export const appConfig: ApplicationConfig = {
  providers: [
    providePrimeNG({ theme: { preset: CounterTheme, options: { darkModeSelector: false, cssLayer: { name: 'primeng', order: 'primeng, counter' } } } }),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, cacheInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    { provide: AUTH_PREFIX, useValue: 'vendor' },
  ],
};
