import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { BillingRecordService, BillingStatus } from '@noatgnu/cupcake-salted-caramel';
import type { BillingRecord } from '@noatgnu/cupcake-salted-caramel';
import { BillingRecordDetailModal } from './billing-record-detail-modal';

describe('BillingRecordDetailModal', () => {
  let component: BillingRecordDetailModal;
  let fixture: ComponentFixture<BillingRecordDetailModal>;
  let mockBillingRecordService: jasmine.SpyObj<BillingRecordService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let currentUserSignal: WritableSignal<any>;

  const mockRecord: BillingRecord = {
    id: 'rec-1',
    username: 'Test User',
    userEmail: 'test@example.com',
    billableItemName: 'Instrument Usage',
    quantity: 5,
    billingUnitDisplay: 'hours',
    unitPrice: 100,
    subtotal: 500,
    totalAmount: 500,
    currency: 'USD',
    status: BillingStatus.PENDING,
    statusDisplay: 'Pending',
    costCenter: 'CC-001',
    funder: 'Grant XYZ',
    serviceTierName: 'Basic',
    billingPeriodStart: '2024-01-01T00:00:00Z',
    billingPeriodEnd: '2024-01-31T23:59:59Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  } as BillingRecord;

  beforeEach(async () => {
    currentUserSignal = signal<any>(null);

    mockBillingRecordService = jasmine.createSpyObj('BillingRecordService', [
      'getBillingRecord',
      'approveBillingRecord'
    ]);
    mockBillingRecordService.getBillingRecord.and.returnValue(of(mockRecord));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    mockAuthService = jasmine.createSpyObj('AuthService', [], {
      currentUser: currentUserSignal
    });

    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [BillingRecordDetailModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: BillingRecordService, useValue: mockBillingRecordService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BillingRecordDetailModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('recordId', 'rec-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load billing record on init', () => {
    expect(mockBillingRecordService.getBillingRecord).toHaveBeenCalledWith('rec-1');
    expect(component.record()).toEqual(mockRecord);
    expect(component.loading()).toBeFalse();
  });

  it('isAdmin() returns false when user is null', () => {
    expect(component.isAdmin()).toBeFalse();
  });

  it('isAdmin() returns true when user is staff', () => {
    currentUserSignal.set({ isStaff: true, isSuperuser: false });
    expect(component.isAdmin()).toBeTrue();
  });

  it('isAdmin() returns true when user is superuser', () => {
    currentUserSignal.set({ isStaff: false, isSuperuser: true });
    expect(component.isAdmin()).toBeTrue();
  });

  it('canApprove() returns true when admin and status is pending', () => {
    currentUserSignal.set({ isStaff: true, isSuperuser: false });
    component.record.set(mockRecord);
    expect(component.canApprove()).toBeTrue();
  });

  it('canApprove() returns false when not admin', () => {
    expect(component.canApprove()).toBeFalse();
  });

  it('canApprove() returns false when status is not pending', () => {
    currentUserSignal.set({ isStaff: true, isSuperuser: false });
    component.record.set({ ...mockRecord, status: BillingStatus.APPROVED });
    expect(component.canApprove()).toBeFalse();
  });

  it('approveRecord() calls service when confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const updated = { ...mockRecord, status: BillingStatus.APPROVED };
    mockBillingRecordService.approveBillingRecord.and.returnValue(of(updated as BillingRecord));
    component.record.set(mockRecord);
    component.approveRecord();
    expect(mockBillingRecordService.approveBillingRecord).toHaveBeenCalledWith('rec-1', {});
    expect(mockToastService.success).toHaveBeenCalledWith('Billing record approved successfully');
    expect(mockActiveModal.close).toHaveBeenCalled();
  });

  it('approveRecord() does nothing when no record set', () => {
    component.record.set(null);
    component.approveRecord();
    expect(mockBillingRecordService.approveBillingRecord).not.toHaveBeenCalled();
  });

  it('close() dismisses the modal', () => {
    component.close();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });

  it('getStatusBadgeClass() returns correct class', () => {
    expect(component.getStatusBadgeClass('pending')).toBe('bg-warning text-dark');
    expect(component.getStatusBadgeClass('approved')).toBe('bg-info text-dark');
    expect(component.getStatusBadgeClass('paid')).toBe('bg-success');
    expect(component.getStatusBadgeClass('unknown')).toBe('bg-secondary');
  });
});
