import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor, CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: environment.apiUrl } },
    provideHttpClient(
      withInterceptors([authInterceptor])
    )
  ]
};
