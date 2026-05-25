import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import {
  ServicePriceService,
  ServicePrice,
  ServicePriceQueryParams,
  BillingUnit,
  ServiceTierService,
  BillableItemTypeService
} from '@noatgnu/cupcake-salted-caramel';
import { ServicePriceFormModal } from '../service-price-form-modal/service-price-form-modal';
import { BillingNavbar } from '../billing-navbar/billing-navbar';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-service-prices',
  imports: [FormsModule, BillingNavbar, NgbTooltipModule],
  templateUrl: './service-prices.html',
  styleUrl: './service-prices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServicePrices implements OnInit {
  private servicePriceService = inject(ServicePriceService);
  private serviceTierService = inject(ServiceTierService);
  private billableItemTypeService = inject(BillableItemTypeService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);

  servicePrices = signal<ServicePrice[]>([]);
  loading = signal(false);
  page = signal(1);
  pageSize = 10;
  total = signal(0);
  searchQuery = signal('');
  isActiveFilter = signal<boolean | ''>('');
  isCurrentFilter = signal<boolean | ''>('');
  billingUnitFilter = signal<BillingUnit | ''>('');
  serviceTierFilter = signal<number | ''>('');
  billableItemTypeFilter = signal<number | ''>('');
  showFilters = signal(false);

  readonly BillingUnit = BillingUnit;
  readonly billingUnits = Object.values(BillingUnit);
  readonly Math = Math;

  availableServiceTiers = signal<Array<{id: number; name: string}>>([]);
  availableBillableItemTypes = signal<Array<{id: number; name: string}>>([]);

  currentUser = this.authService.currentUser;
  isAdmin = computed(() => {
    const user = this.currentUser();
    return user?.isStaff || user?.isSuperuser || false;
  });

  ngOnInit(): void {
    this.loadServicePrices();
    this.loadServiceTiers();
    this.loadBillableItemTypes();
  }

  loadServiceTiers(): void {
    this.serviceTierService.getServiceTiers({ limit: 100 }).subscribe({
      next: (response) => {
        this.availableServiceTiers.set(
          response.results.map(tier => ({ id: tier.id, name: tier.tierName }))
        );
      },
      error: () => {}
    });
  }

  loadBillableItemTypes(): void {
    this.billableItemTypeService.getBillableItemTypes({ limit: 100 }).subscribe({
      next: (response) => {
        this.availableBillableItemTypes.set(
          response.results.map(item => ({ id: item.id, name: item.name }))
        );
      },
      error: () => {}
    });
  }

  loadServicePrices(): void {
    this.loading.set(true);
    const params: ServicePriceQueryParams = {
      limit: this.pageSize,
      offset: (this.page() - 1) * this.pageSize
    };

    if (this.searchQuery()) {
      params.search = this.searchQuery();
    }

    if (this.isActiveFilter() !== '') {
      params.isActive = this.isActiveFilter() as boolean;
    }

    if (this.billingUnitFilter()) {
      params.billingUnit = this.billingUnitFilter() as BillingUnit;
    }

    if (this.serviceTierFilter()) {
      params.serviceTier = this.serviceTierFilter() as number;
    }

    if (this.billableItemTypeFilter()) {
      params.billableItemType = this.billableItemTypeFilter() as number;
    }

    this.servicePriceService.getServicePrices(params).subscribe({
      next: (response) => {
        this.servicePrices.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load service prices');
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.page.set(1);
    this.loadServicePrices();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadServicePrices();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.isActiveFilter.set('');
    this.isCurrentFilter.set('');
    this.billingUnitFilter.set('');
    this.serviceTierFilter.set('');
    this.billableItemTypeFilter.set('');
    this.page.set(1);
    this.loadServicePrices();
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadServicePrices();
    }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) {
      this.page.update(p => p + 1);
      this.loadServicePrices();
    }
  }

  openCreateModal(): void {
    const modalRef = this.modalService.open(ServicePriceFormModal, {
      size: 'lg',
      scrollable: true
    });

    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadServicePrices();
      }
    });
  }

  openEditModal(price: ServicePrice): void {
    const modalRef = this.modalService.open(ServicePriceFormModal, {
      size: 'lg',
      scrollable: true
    });
    modalRef.componentInstance.servicePrice = price;

    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadServicePrices();
      }
    });
  }

  deletePrice(id: number): void {
    if (!confirm('Are you sure you want to delete this service price? This action cannot be undone.')) {
      return;
    }

    this.servicePriceService.deleteServicePrice(id).subscribe({
      next: () => {
        this.toastService.success('Service price deleted successfully');
        this.loadServicePrices();
      },
      error: () => {
        this.toastService.error('Failed to delete service price');
      }
    });
  }

  getBillingUnitDisplay(unit: BillingUnit): string {
    const displays: Record<BillingUnit, string> = {
      [BillingUnit.HOURLY]: 'Hourly',
      [BillingUnit.DAILY]: 'Daily',
      [BillingUnit.USAGE]: 'Usage',
      [BillingUnit.SAMPLE]: 'Sample',
      [BillingUnit.FLAT]: 'Flat Rate',
      [BillingUnit.CUSTOM]: 'Custom'
    };
    return displays[unit] || unit;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
}
