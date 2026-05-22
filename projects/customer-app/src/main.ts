import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { API_BASE_URL, AUTH_PREFIX, authInterceptor } from '@shared/public-api';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimationsAsync(),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    { provide: AUTH_PREFIX, useValue: 'customer' },
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
  ],
}).catch((err) => console.error(err));
