import { Routes } from '@angular/router';
import { BillingRecords } from './billing-records/billing-records';
import { ServiceTiers } from './service-tiers/service-tiers';
import { BillableItemTypes } from './billable-item-types/billable-item-types';
import { ServicePrices } from './service-prices/service-prices';

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
  },
  {
    path: 'service-tiers',
    component: ServiceTiers,
    title: 'Service Tiers'
  },
  {
    path: 'billable-item-types',
    component: BillableItemTypes,
    title: 'Billable Item Types'
  },
  {
    path: 'service-prices',
    component: ServicePrices,
    title: 'Service Prices'
  }
];
