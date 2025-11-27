import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BillingRecordService, BillingStatus } from '@noatgnu/cupcake-salted-caramel';
import type { BillingRecord } from '@noatgnu/cupcake-salted-caramel';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-billing-record-detail-modal',
  imports: [CommonModule],
  templateUrl: './billing-record-detail-modal.html',
  styleUrl: './billing-record-detail-modal.scss'
})
export class BillingRecordDetailModal {
  activeModal = inject(NgbActiveModal);
  private billingRecordService = inject(BillingRecordService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  recordId = input.required<string>();
  record = signal<BillingRecord | null>(null);
  loading = signal(true);
  approving = signal(false);

  ngOnInit(): void {
    this.loadRecord();
  }

  loadRecord(): void {
    this.loading.set(true);
    this.billingRecordService.getBillingRecord(this.recordId()).subscribe({
      next: (record) => {
        this.record.set(record);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading billing record:', err);
        this.toastService.error('Failed to load billing record details');
        this.loading.set(false);
      }
    });
  }

  isAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    return user ? (user.isStaff || user.isSuperuser) : false;
  }

  canApprove(): boolean {
    const rec = this.record();
    return this.isAdmin() && rec?.status === BillingStatus.PENDING;
  }

  approveRecord(): void {
    const rec = this.record();
    if (!rec) return;

    if (!confirm(`Are you sure you want to approve this billing record for ${rec.totalAmount} ${rec.currency}?`)) {
      return;
    }

    this.approving.set(true);
    this.billingRecordService.approveBillingRecord(rec.id, {}).subscribe({
      next: (updated) => {
        this.record.set(updated);
        this.toastService.success('Billing record approved successfully');
        this.approving.set(false);
        this.activeModal.close(updated);
      },
      error: (err) => {
        console.error('Error approving billing record:', err);
        this.toastService.error('Failed to approve billing record');
        this.approving.set(false);
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'pending': 'bg-warning text-dark',
      'approved': 'bg-info text-dark',
      'billed': 'bg-primary',
      'paid': 'bg-success',
      'disputed': 'bg-danger',
      'cancelled': 'bg-secondary'
    };
    return classes[status] || 'bg-secondary';
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
