import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import {
  BillableItemTypeService,
  BillableItemType,
  BillableItemTypeQueryParams,
  BillingUnit
} from '@noatgnu/cupcake-salted-caramel';
import { BillableItemTypeFormModal } from '../billable-item-type-form-modal/billable-item-type-form-modal';
import { BillingNavbar } from '../billing-navbar/billing-navbar';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-billable-item-types',
  imports: [FormsModule, BillingNavbar, NgbTooltipModule],
  templateUrl: './billable-item-types.html',
  styleUrl: './billable-item-types.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillableItemTypes implements OnInit {
  private billableItemTypeService = inject(BillableItemTypeService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);

  billableItemTypes = signal<BillableItemType[]>([]);
  loading = signal(false);
  page = signal(1);
  pageSize = 10;
  total = signal(0);
  searchQuery = signal('');
  isActiveFilter = signal<boolean | ''>('');
  requiresApprovalFilter = signal<boolean | ''>('');
  billingUnitFilter = signal<BillingUnit | ''>('');
  showFilters = signal(false);

  readonly BillingUnit = BillingUnit;
  readonly billingUnits = Object.values(BillingUnit);
  readonly Math = Math;

  currentUser = this.authService.currentUser;
  isAdmin = computed(() => {
    const user = this.currentUser();
    return user?.isStaff || user?.isSuperuser || false;
  });

  ngOnInit(): void {
    this.loadBillableItemTypes();
  }

  loadBillableItemTypes(): void {
    this.loading.set(true);
    const params: BillableItemTypeQueryParams = {
      limit: this.pageSize,
      offset: (this.page() - 1) * this.pageSize
    };

    if (this.searchQuery()) {
      params.search = this.searchQuery();
    }

    if (this.isActiveFilter() !== '') {
      params.isActive = this.isActiveFilter() as boolean;
    }

    if (this.requiresApprovalFilter() !== '') {
      params.requiresApproval = this.requiresApprovalFilter() as boolean;
    }

    if (this.billingUnitFilter()) {
      params.defaultBillingUnit = this.billingUnitFilter() as BillingUnit;
    }

    this.billableItemTypeService.getBillableItemTypes(params).subscribe({
      next: (response) => {
        this.billableItemTypes.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load billable item types');
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.page.set(1);
    this.loadBillableItemTypes();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadBillableItemTypes();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.isActiveFilter.set('');
    this.requiresApprovalFilter.set('');
    this.billingUnitFilter.set('');
    this.page.set(1);
    this.loadBillableItemTypes();
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadBillableItemTypes();
    }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) {
      this.page.update(p => p + 1);
      this.loadBillableItemTypes();
    }
  }

  openCreateModal(): void {
    const modalRef = this.modalService.open(BillableItemTypeFormModal, {
      size: 'lg',
      scrollable: true
    });

    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadBillableItemTypes();
      }
    });
  }

  openEditModal(itemType: BillableItemType): void {
    const modalRef = this.modalService.open(BillableItemTypeFormModal, {
      size: 'lg',
      scrollable: true
    });
    modalRef.componentInstance.billableItemType = itemType;

    modalRef.closed.subscribe((result) => {
      if (result) {
        this.loadBillableItemTypes();
      }
    });
  }

  deleteItemType(id: number): void {
    if (!confirm('Are you sure you want to delete this billable item type? This action cannot be undone.')) {
      return;
    }

    this.billableItemTypeService.deleteBillableItemType(id).subscribe({
      next: () => {
        this.toastService.success('Billable item type deleted successfully');
        this.loadBillableItemTypes();
      },
      error: () => {
        this.toastService.error('Failed to delete billable item type');
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
}
