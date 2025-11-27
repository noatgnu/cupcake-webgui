import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule, NgbTooltipModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BillingRecordService, BillingStatus } from '@noatgnu/cupcake-salted-caramel';
import type { BillingRecord, PaginatedResponse, BillingRecordQueryParams } from '@noatgnu/cupcake-salted-caramel';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { BillingNavbar } from '../billing-navbar/billing-navbar';
import { BillingRecordDetailModal } from '../billing-record-detail-modal/billing-record-detail-modal';

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
  private modalService = inject(NgbModal);

  billingRecords = signal<BillingRecord[]>([]);
  loading = signal(false);
  page = signal(1);
  pageSize = 10;
  total = signal(0);
  statusFilter = signal<BillingStatus | ''>('');
  searchQuery = signal('');
  costCenterFilter = signal('');
  funderFilter = signal('');
  startDate = signal('');
  endDate = signal('');
  selectedRecords = signal<Set<string>>(new Set());
  showAdvancedFilters = signal(false);

  readonly Math = Math;

  ngOnInit(): void {
    this.loadBillingRecords();
  }

  isAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    return user ? (user.isStaff || user.isSuperuser) : false;
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

    if (this.costCenterFilter()) {
      params.costCenter = this.costCenterFilter();
    }

    if (this.startDate()) {
      params.dateFrom = this.startDate();
    }

    if (this.endDate()) {
      params.dateTo = this.endDate();
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

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update(v => !v);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('');
    this.costCenterFilter.set('');
    this.funderFilter.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.page.set(1);
    this.loadBillingRecords();
  }

  viewDetails(record: BillingRecord): void {
    const modalRef = this.modalService.open(BillingRecordDetailModal, {
      size: 'xl',
      scrollable: true
    });
    const component = modalRef.componentInstance as BillingRecordDetailModal;
    Object.defineProperty(component, 'recordId', {
      value: signal(record.id),
      writable: false,
      configurable: true
    });

    modalRef.result.then(
      (result) => {
        if (result) {
          this.loadBillingRecords();
        }
      },
      () => {}
    );
  }

  toggleRecordSelection(recordId: string): void {
    const selected = this.selectedRecords();
    if (selected.has(recordId)) {
      selected.delete(recordId);
    } else {
      selected.add(recordId);
    }
    this.selectedRecords.set(new Set(selected));
  }

  selectAllRecords(): void {
    const allIds = this.billingRecords().map(r => r.id);
    this.selectedRecords.set(new Set(allIds));
  }

  deselectAllRecords(): void {
    this.selectedRecords.set(new Set());
  }

  bulkApprove(): void {
    const selected = Array.from(this.selectedRecords());
    if (selected.length === 0) {
      this.toastService.warning('Please select at least one record to approve');
      return;
    }

    const pendingRecords = this.billingRecords().filter(
      r => selected.includes(r.id) && r.status === BillingStatus.PENDING
    );

    if (pendingRecords.length === 0) {
      this.toastService.warning('No pending records selected');
      return;
    }

    if (!confirm(`Are you sure you want to approve ${pendingRecords.length} billing record(s)?`)) {
      return;
    }

    let completed = 0;
    let errors = 0;

    pendingRecords.forEach(record => {
      this.billingRecordService.approveBillingRecord(record.id, {}).subscribe({
        next: () => {
          completed++;
          if (completed + errors === pendingRecords.length) {
            this.handleBulkApproveComplete(completed, errors);
          }
        },
        error: (err) => {
          console.error('Error approving record:', err);
          errors++;
          if (completed + errors === pendingRecords.length) {
            this.handleBulkApproveComplete(completed, errors);
          }
        }
      });
    });
  }

  private handleBulkApproveComplete(completed: number, errors: number): void {
    if (errors === 0) {
      this.toastService.success(`Successfully approved ${completed} record(s)`);
    } else {
      this.toastService.warning(`Approved ${completed} record(s), ${errors} failed`);
    }
    this.deselectAllRecords();
    this.loadBillingRecords();
  }

  exportToCSV(): void {
    const records = this.billingRecords();
    if (records.length === 0) {
      this.toastService.warning('No records to export');
      return;
    }

    const headers = [
      'Record ID',
      'User',
      'Email',
      'Item Type',
      'Quantity',
      'Unit Price',
      'Subtotal',
      'Setup Fee',
      'Discount',
      'Tax',
      'Total Amount',
      'Currency',
      'Status',
      'Cost Center',
      'Funder',
      'Billing Period Start',
      'Billing Period End',
      'Created At'
    ];

    const rows = records.map(r => [
      r.id,
      r.username,
      r.userEmail || '',
      r.billableItemName,
      r.quantity,
      r.unitPrice,
      r.subtotal,
      r.setupFee || 0,
      r.discountAmount || 0,
      r.taxAmount || 0,
      r.totalAmount,
      r.currency,
      r.statusDisplay,
      r.costCenter || '',
      r.funder || '',
      r.billingPeriodStart,
      r.billingPeriodEnd,
      r.createdAt
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `billing-records-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastService.success(`Exported ${records.length} record(s) to CSV`);
  }

  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'pending': 'bg-warning text-dark',
      'approved': 'bg-info text-dark',
      'billed': 'bg-primary',
      'paid': 'bg-success',
      'disputed': 'bg-danger',
      'cancelled': 'bg-secondary'
    };
    return statusClasses[status] || 'bg-secondary';
  }
}
