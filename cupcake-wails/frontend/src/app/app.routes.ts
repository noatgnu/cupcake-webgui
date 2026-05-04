import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'splash',
    loadComponent: () => import('./panels/splash/splash.component').then(m => m.SplashComponent)
  },
  {
    path: 'python-selection',
    loadComponent: () => import('./panels/python-selection/python-selection.component').then(m => m.PythonSelectionComponent)
  },
  {
    path: 'downloader',
    loadComponent: () => import('./panels/downloader/downloader.component').then(m => m.DownloaderComponent)
  },
  {
    path: 'backend-download',
    loadComponent: () => import('./panels/downloader/downloader.component').then(m => m.DownloaderComponent),
    data: { downloadType: 'backend' }
  },
  {
    path: 'valkey-download',
    loadComponent: () => import('./panels/downloader/downloader.component').then(m => m.DownloaderComponent),
    data: { downloadType: 'valkey' }
  },
  {
    path: 'backend-setup',
    loadComponent: () => import('./panels/backend-setup/backend-setup.component').then(m => m.BackendSetupComponent)
  },
  {
    path: 'management',
    loadComponent: () => import('./panels/management/management.component').then(m => m.ManagementComponent)
  },
  {
    path: 'debug',
    loadComponent: () => import('./panels/debug/debug.component').then(m => m.DebugComponent)
  },
  {
    path: 'superuser-creation',
    loadComponent: () => import('./panels/superuser/superuser.component').then(m => m.SuperuserComponent)
  },
  {
    path: 'password-reset',
    loadComponent: () => import('./panels/password-reset/password-reset').then(m => m.PasswordResetComponent)
  },
  {
    path: '',
    redirectTo: '/splash',
    pathMatch: 'full'
  }
];
