import { Routes } from '@angular/router';
import { adminGuard } from '@noatgnu/cupcake-core';
import { superuserGuard } from '../../core/guards/superuser.guard';
import { SiteConfig } from './site-config/site-config';
import { WorkerStatus } from './worker-status/worker-status';

export const adminRoutes: Routes = [
  {
    path: '',
    redirectTo: 'site-config',
    pathMatch: 'full'
  },
  {
    path: 'site-config',
    component: SiteConfig,
    canActivate: [adminGuard],
    title: 'Site Configuration'
  },
  {
    path: 'worker-status',
    component: WorkerStatus,
    canActivate: [superuserGuard],
    title: 'Worker Status'
  }
];
