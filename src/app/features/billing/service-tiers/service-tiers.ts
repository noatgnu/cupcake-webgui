import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule, NgbTooltipModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ServiceTierService } from '@noatgnu/cupcake-salted-caramel';
import type { ServiceTier, PaginatedResponse, ServiceTierQueryParams } from '@noatgnu/cupcake-salted-caramel';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { BillingNavbar } from '../billing-navbar/billing-navbar';
import { ServiceTierFormModal } from '../service-tier-form-modal/service-tier-form-modal';

@Component({
  selector: 'app-service-tiers',
  imports: [BillingNavbar, CommonModule, FormsModule, NgbPaginationModule, NgbTooltipModule],
  templateUrl: './service-tiers.html',
  styleUrl: './service-tiers.scss',
})
export class ServiceTiers implements OnInit {
  private serviceTierService = inject(ServiceTierService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);

  serviceTiers = signal<ServiceTier[]>([]);
  loading = signal(false);
  page = signal(1);
  pageSize = 10;
  total = signal(0);
  searchQuery = signal('');
  isActiveFilter = signal<boolean | ''>('');
  showFilters = signal(false);

  readonly Math = Math;

  ngOnInit(): void {
    this.loadServiceTiers();
  }

  isAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    return user ? (user.isStaff || user.isSuperuser) : false;
  }

  loadServiceTiers(): void {
    this.loading.set(true);
    const params: ServiceTierQueryParams = {
      limit: this.pageSize,
      offset: (this.page() - 1) * this.pageSize
    };

    if (this.searchQuery()) {
      params.search = this.searchQuery();
    }

    if (this.isActiveFilter() !== '') {
      params.isActive = this.isActiveFilter() as boolean;
    }

    this.serviceTierService.getServiceTiers(params).subscribe({
      next: (response: PaginatedResponse<ServiceTier>) => {
        this.serviceTiers.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Error loading service tiers:', err);
        this.toastService.error('Failed to load service tiers');
        this.loading.set(false);
      }
    });
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadServiceTiers();
  }

  onSearch(): void {
    this.page.set(1);
    this.loadServiceTiers();
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.isActiveFilter.set('');
    this.page.set(1);
    this.loadServiceTiers();
  }

  openCreateModal(): void {
    const modalRef = this.modalService.open(ServiceTierFormModal, {
      size: 'lg',
      scrollable: true
    });

    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadServiceTiers();
        }
      },
      () => {}
    );
  }

  openEditModal(tier: ServiceTier): void {
    const modalRef = this.modalService.open(ServiceTierFormModal, {
      size: 'lg',
      scrollable: true
    });
    const component = modalRef.componentInstance as ServiceTierFormModal;
    Object.defineProperty(component, 'tierId', {
      value: signal(tier.id),
      writable: false,
      configurable: true
    });

    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadServiceTiers();
        }
      },
      () => {}
    );
  }

  deleteTier(tier: ServiceTier): void {
    if (!confirm(`Are you sure you want to delete the service tier "${tier.tierName}"? This action cannot be undone.`)) {
      return;
    }

    this.serviceTierService.deleteServiceTier(tier.id).subscribe({
      next: () => {
        this.toastService.success('Service tier deleted successfully');
        this.loadServiceTiers();
      },
      error: (err) => {
        console.error('Error deleting service tier:', err);
        this.toastService.error('Failed to delete service tier');
      }
    });
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'bg-success' : 'bg-secondary';
  }
}
