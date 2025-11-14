import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { BillingRecordService } from '@noatgnu/cupcake-salted-caramel';
import type { BillingRecord, BillingStatus, PaginatedResponse, BillingRecordQueryParams } from '@noatgnu/cupcake-salted-caramel';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { BillingNavbar } from '../billing-navbar/billing-navbar';

@Component({
  selector: 'app-billing-records',
  imports: [BillingNavbar, CommonModule, FormsModule, NgbPaginationModule, NgbTooltipModule],
  templateUrl: './billing-records.html',
  styleUrl: './billing-records.scss',
})
export class BillingRecords implements OnInit {
  private billingRecordService = inject(BillingRecordService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  billingRecords = signal<BillingRecord[]>([]);
  loading = signal(false);
  page = signal(1);
  pageSize = 10;
  total = signal(0);
  statusFilter = signal<BillingStatus | ''>('');
  searchQuery = signal('');

  readonly Math = Math;

  ngOnInit(): void {
    this.loadBillingRecords();
  }

  loadBillingRecords(): void {
    this.loading.set(true);
    const params: BillingRecordQueryParams = {
      limit: this.pageSize,
      offset: (this.page() - 1) * this.pageSize
    };

    if (this.statusFilter()) {
      params.status = this.statusFilter() as BillingStatus;
    }

    if (this.searchQuery()) {
      params.search = this.searchQuery();
    }

    this.billingRecordService.getBillingRecords(params).subscribe({
      next: (response: PaginatedResponse<BillingRecord>) => {
        this.billingRecords.set(response.results);
        this.total.set(response.count);
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Error loading billing records:', err);
        this.toastService.error('Failed to load billing records');
        this.loading.set(false);
      }
    });
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadBillingRecords();
  }

  onStatusFilterChange(status: BillingStatus | ''): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadBillingRecords();
  }

  onSearch(): void {
    this.page.set(1);
    this.loadBillingRecords();
  }

  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'pending': 'bg-warning',
      'approved': 'bg-info',
      'billed': 'bg-primary',
      'paid': 'bg-success',
      'disputed': 'bg-danger',
      'cancelled': 'bg-secondary'
    };
    return statusClasses[status] || 'bg-secondary';
  }
}
