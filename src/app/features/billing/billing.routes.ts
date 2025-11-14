import { Routes } from '@angular/router';
import { BillingRecords } from './billing-records/billing-records';

export const billingRoutes: Routes = [
  {
    path: '',
    redirectTo: 'records',
    pathMatch: 'full'
  },
  {
    path: 'records',
    component: BillingRecords,
    title: 'Billing Records'
  }
];
