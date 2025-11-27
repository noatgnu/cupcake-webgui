import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';

import { BillingRecordDetailModal } from './billing-record-detail-modal';
import { BillingRecordService, BillingStatus } from '@noatgnu/cupcake-salted-caramel';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import type { BillingRecord } from '@noatgnu/cupcake-salted-caramel';

describe('BillingRecordDetailModal', () => {
  let component: BillingRecordDetailModal;
  let fixture: ComponentFixture<BillingRecordDetailModal>;
  let mockBillingRecordService: jasmine.SpyObj<BillingRecordService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  const mockBillingRecord: BillingRecord = {
    id: 'test-id-123',
    username: 'Test User',
    userEmail: 'test@example.com',
    billableItemName: 'Instrument Usage',
    description: 'Test description',
    quantity: 5,
    billingUnitDisplay: 'hours',
    unitPrice: 100,
    subtotal: 500,
    setupFee: 50,
    discountAmount: 25,
    taxAmount: 10,
    totalAmount: 535,
    currency: 'USD',
    status: BillingStatus.PENDING,
    statusDisplay: 'Pending',
    costCenter: 'CC-001',
    funder: 'Grant XYZ',
    serviceTierName: 'Basic',
    billingPeriodStart: '2024-01-01T00:00:00Z',
    billingPeriodEnd: '2024-01-31T23:59:59Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    notes: 'Test notes'
  } as BillingRecord;

  beforeEach(async () => {
    mockBillingRecordService = jasmine.createSpyObj('BillingRecordService', [
      'getBillingRecord',
      'approveBillingRecord'
    ]);
    mockToastService = jasmine.createSpyObj('ToastService', ['error', 'success']);
    mockAuthService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [BillingRecordDetailModal],
      providers: [
        { provide: BillingRecordService, useValue: mockBillingRecordService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BillingRecordDetailModal);
    component = fixture.componentInstance;

    Object.defineProperty(component, 'recordId', {
      value: signal('test-id-123'),
      writable: false,
      configurable: true
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load billing record on init', () => {
    mockBillingRecordService.getBillingRecord.and.returnValue(of(mockBillingRecord));

    component.ngOnInit();

    expect(mockBillingRecordService.getBillingRecord).toHaveBeenCalledWith('test-id-123');
    expect(component.record()).toEqual(mockBillingRecord);
    expect(component.loading()).toBe(false);
  });

  it('should handle error when loading billing record', () => {
    mockBillingRecordService.getBillingRecord.and.returnValue(
      throwError(() => new Error('Test error'))
    );

    component.ngOnInit();

    expect(mockToastService.error).toHaveBeenCalledWith('Failed to load billing record details');
    expect(component.loading()).toBe(false);
  });

  it('should return true for isAdmin when user is staff', () => {
    mockAuthService.getCurrentUser.and.returnValue({ isStaff: true, isSuperuser: false } as any);

    expect(component.isAdmin()).toBe(true);
  });

  it('should return true for isAdmin when user is superuser', () => {
    mockAuthService.getCurrentUser.and.returnValue({ isStaff: false, isSuperuser: true } as any);

    expect(component.isAdmin()).toBe(true);
  });

  it('should return false for isAdmin when user is not staff or superuser', () => {
    mockAuthService.getCurrentUser.and.returnValue({ isStaff: false, isSuperuser: false } as any);

    expect(component.isAdmin()).toBe(false);
  });

  it('should return true for canApprove when admin and status is pending', () => {
    mockAuthService.getCurrentUser.and.returnValue({ isStaff: true, isSuperuser: false } as any);
    component.record.set(mockBillingRecord);

    expect(component.canApprove()).toBe(true);
  });

  it('should return false for canApprove when not admin', () => {
    mockAuthService.getCurrentUser.and.returnValue({ isStaff: false, isSuperuser: false } as any);
    component.record.set(mockBillingRecord);

    expect(component.canApprove()).toBe(false);
  });

  it('should return false for canApprove when status is not pending', () => {
    mockAuthService.getCurrentUser.and.returnValue({ isStaff: true, isSuperuser: false } as any);
    component.record.set({ ...mockBillingRecord, status: BillingStatus.APPROVED });

    expect(component.canApprove()).toBe(false);
  });

  it('should approve billing record', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const updatedRecord = { ...mockBillingRecord, status: BillingStatus.APPROVED };
    mockBillingRecordService.approveBillingRecord.and.returnValue(of(updatedRecord as BillingRecord));
    component.record.set(mockBillingRecord);

    component.approveRecord();

    expect(window.confirm).toHaveBeenCalled();
    expect(mockBillingRecordService.approveBillingRecord).toHaveBeenCalledWith('test-id-123', {});
    expect(mockToastService.success).toHaveBeenCalledWith('Billing record approved successfully');
    expect(mockActiveModal.close).toHaveBeenCalledWith(updatedRecord);
  });

  it('should not approve billing record when user cancels confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.record.set(mockBillingRecord);

    component.approveRecord();

    expect(mockBillingRecordService.approveBillingRecord).not.toHaveBeenCalled();
  });

  it('should handle error when approving billing record', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockBillingRecordService.approveBillingRecord.and.returnValue(
      throwError(() => new Error('Test error'))
    );
    component.record.set(mockBillingRecord);

    component.approveRecord();

    expect(mockToastService.error).toHaveBeenCalledWith('Failed to approve billing record');
    expect(component.approving()).toBe(false);
  });

  it('should return correct badge class for status', () => {
    expect(component.getStatusBadgeClass('pending')).toBe('bg-warning text-dark');
    expect(component.getStatusBadgeClass('approved')).toBe('bg-info text-dark');
    expect(component.getStatusBadgeClass('billed')).toBe('bg-primary');
    expect(component.getStatusBadgeClass('paid')).toBe('bg-success');
    expect(component.getStatusBadgeClass('disputed')).toBe('bg-danger');
    expect(component.getStatusBadgeClass('cancelled')).toBe('bg-secondary');
    expect(component.getStatusBadgeClass('unknown')).toBe('bg-secondary');
  });

  it('should close modal', () => {
    component.close();

    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
