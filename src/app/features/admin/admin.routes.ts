import { Routes } from '@angular/router';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { adminGuard } from '@noatgnu/cupcake-core';
import { superuserGuard } from '../../core/guards/superuser.guard';
import { SiteConfig } from './site-config/site-config';
import { WorkerStatus } from './worker-status/worker-status';
import { StorageAdmin } from './storage-admin/storage-admin';
import { BackupAdmin } from './backup-admin/backup-admin';
import { environment } from '../../../environments/environment';

const applianceGuard = () => {
  const router = inject(Router);
  if (!(environment as any).isAppliance) {
    return router.parseUrl('/home');
  }
  return true;
};

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
  },
  {
    path: 'storage',
    component: StorageAdmin,
    canActivate: [adminGuard, applianceGuard],
    title: 'Storage Management'
  },
  {
    path: 'backup',
    component: BackupAdmin,
    canActivate: [adminGuard, applianceGuard],
    title: 'Backup Management'
  }
];
