import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError } from 'rxjs';

import { BillingRecords } from './billing-records';
import { BillingRecordService, BillingStatus } from '@noatgnu/cupcake-salted-caramel';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import type { BillingRecord, PaginatedResponse } from '@noatgnu/cupcake-salted-caramel';

describe('BillingRecords', () => {
  let component: BillingRecords;
  let fixture: ComponentFixture<BillingRecords>;
  let mockBillingRecordService: jasmine.SpyObj<BillingRecordService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;

  const mockBillingRecords: BillingRecord[] = [
    {
      id: 'record-1',
      username: 'User 1',
      userEmail: 'user1@example.com',
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
      funder: 'Grant 1',
      serviceTierName: 'Basic',
      billingPeriodStart: '2024-01-01T00:00:00Z',
      billingPeriodEnd: '2024-01-31T23:59:59Z',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z'
    },
    {
      id: 'record-2',
      username: 'User 2',
      userEmail: 'user2@example.com',
      billableItemName: 'Instrument Job',
      quantity: 10,
      billingUnitDisplay: 'samples',
      unitPrice: 50,
      subtotal: 500,
      totalAmount: 500,
      currency: 'USD',
      status: BillingStatus.APPROVED,
      statusDisplay: 'Approved',
      costCenter: 'CC-002',
      funder: 'Grant 2',
      serviceTierName: 'Premium',
      billingPeriodStart: '2024-01-01T00:00:00Z',
      billingPeriodEnd: '2024-01-31T23:59:59Z',
      createdAt: '2024-01-16T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z'
    }
  ] as BillingRecord[];

  const mockPaginatedResponse: PaginatedResponse<BillingRecord> = {
    count: 2,
    next: undefined,
    previous: undefined,
    results: mockBillingRecords
  };

  beforeEach(async () => {
    mockBillingRecordService = jasmine.createSpyObj('BillingRecordService', [
      'getBillingRecords',
      'approveBillingRecord'
    ]);
    mockToastService = jasmine.createSpyObj('ToastService', [
      'error',
      'success',
      'warning'
    ]);
    mockAuthService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [BillingRecords, FormsModule],
      providers: [
        { provide: BillingRecordService, useValue: mockBillingRecordService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BillingRecords);
    component = fixture.componentInstance;

    mockBillingRecordService.getBillingRecords.and.returnValue(of(mockPaginatedResponse));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load billing records on init', () => {
    component.ngOnInit();

    expect(mockBillingRecordService.getBillingRecords).toHaveBeenCalled();
    expect(component.billingRecords()).toEqual(mockBillingRecords);
    expect(component.total()).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should handle error when loading billing records', () => {
    mockBillingRecordService.getBillingRecords.and.returnValue(
      throwError(() => new Error('Test error'))
    );

    component.ngOnInit();

    expect(mockToastService.error).toHaveBeenCalledWith('Failed to load billing records');
    expect(component.loading()).toBe(false);
  });

  it('should filter by status', () => {
    component.onStatusFilterChange(BillingStatus.PENDING);

    expect(component.statusFilter()).toBe(BillingStatus.PENDING);
    expect(component.page()).toBe(1);
    expect(mockBillingRecordService.getBillingRecords).toHaveBeenCalledWith(
      jasmine.objectContaining({ status: BillingStatus.PENDING })
    );
  });

  it('should filter by search query', () => {
    component.searchQuery.set('test query');
    component.onSearch();

    expect(component.page()).toBe(1);
    expect(mockBillingRecordService.getBillingRecords).toHaveBeenCalledWith(
      jasmine.objectContaining({ search: 'test query' })
    );
  });

  it('should filter by cost center when advanced filters applied', () => {
    component.costCenterFilter.set('CC-001');
    component.loadBillingRecords();

    expect(mockBillingRecordService.getBillingRecords).toHaveBeenCalledWith(
      jasmine.objectContaining({ costCenter: 'CC-001' })
    );
  });

  it('should filter by date range', () => {
    component.startDate.set('2024-01-01');
    component.endDate.set('2024-01-31');
    component.loadBillingRecords();

    expect(mockBillingRecordService.getBillingRecords).toHaveBeenCalledWith(
      jasmine.objectContaining({
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      })
    );
  });

  it('should change page', () => {
    component.onPageChange(2);

    expect(component.page()).toBe(2);
    expect(mockBillingRecordService.getBillingRecords).toHaveBeenCalledWith(
      jasmine.objectContaining({ offset: 10 })
    );
  });

  it('should toggle advanced filters', () => {
    expect(component.showAdvancedFilters()).toBe(false);

    component.toggleAdvancedFilters();

    expect(component.showAdvancedFilters()).toBe(true);

    component.toggleAdvancedFilters();

    expect(component.showAdvancedFilters()).toBe(false);
  });

  it('should clear all filters', () => {
    component.searchQuery.set('test');
    component.statusFilter.set(BillingStatus.PENDING);
    component.costCenterFilter.set('CC-001');
    component.startDate.set('2024-01-01');
    component.endDate.set('2024-01-31');
    component.page.set(2);

    component.clearFilters();

    expect(component.searchQuery()).toBe('');
    expect(component.statusFilter()).toBe('');
    expect(component.costCenterFilter()).toBe('');
    expect(component.startDate()).toBe('');
    expect(component.endDate()).toBe('');
    expect(component.page()).toBe(1);
    expect(mockBillingRecordService.getBillingRecords).toHaveBeenCalled();
  });

  it('should return true for isAdmin when user is staff', () => {
    mockAuthService.getCurrentUser.and.returnValue({ isStaff: true, isSuperuser: false } as any);

    expect(component.isAdmin()).toBe(true);
  });

  it('should return false for isAdmin when user is not staff', () => {
    mockAuthService.getCurrentUser.and.returnValue({ isStaff: false, isSuperuser: false } as any);

    expect(component.isAdmin()).toBe(false);
  });

  it('should open detail modal when viewDetails is called', () => {
    const mockModalRef = {
      componentInstance: {},
      result: Promise.resolve(null)
    } as any;
    mockModalService.open.and.returnValue(mockModalRef);

    component.viewDetails(mockBillingRecords[0]);

    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should toggle record selection', () => {
    const recordId = 'record-1';

    component.toggleRecordSelection(recordId);
    expect(component.selectedRecords().has(recordId)).toBe(true);

    component.toggleRecordSelection(recordId);
    expect(component.selectedRecords().has(recordId)).toBe(false);
  });

  it('should select all records', () => {
    component.billingRecords.set(mockBillingRecords);

    component.selectAllRecords();

    expect(component.selectedRecords().size).toBe(2);
    expect(component.selectedRecords().has('record-1')).toBe(true);
    expect(component.selectedRecords().has('record-2')).toBe(true);
  });

  it('should deselect all records', () => {
    component.selectedRecords.set(new Set(['record-1', 'record-2']));

    component.deselectAllRecords();

    expect(component.selectedRecords().size).toBe(0);
  });

  it('should show warning when bulk approve with no selection', () => {
    component.bulkApprove();

    expect(mockToastService.warning).toHaveBeenCalledWith(
      'Please select at least one record to approve'
    );
  });

  it('should show warning when bulk approve with no pending records', () => {
    component.billingRecords.set(mockBillingRecords);
    component.selectedRecords.set(new Set(['record-2'])); // record-2 is approved

    component.bulkApprove();

    expect(mockToastService.warning).toHaveBeenCalledWith('No pending records selected');
  });

  it('should approve selected pending records', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockBillingRecordService.approveBillingRecord.and.returnValue(
      of(mockBillingRecords[0] as any)
    );
    component.billingRecords.set(mockBillingRecords);
    component.selectedRecords.set(new Set(['record-1']));

    component.bulkApprove();

    expect(window.confirm).toHaveBeenCalled();
    expect(mockBillingRecordService.approveBillingRecord).toHaveBeenCalledWith('record-1', {});
  });

  it('should not approve when user cancels confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.billingRecords.set(mockBillingRecords);
    component.selectedRecords.set(new Set(['record-1']));

    component.bulkApprove();

    expect(mockBillingRecordService.approveBillingRecord).not.toHaveBeenCalled();
  });

  it('should export to CSV', () => {
    component.billingRecords.set(mockBillingRecords);
    const createElementSpy = spyOn(document, 'createElement').and.callThrough();
    const appendChildSpy = spyOn(document.body, 'appendChild');
    const removeChildSpy = spyOn(document.body, 'removeChild');

    component.exportToCSV();

    expect(createElementSpy).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(mockToastService.success).toHaveBeenCalledWith('Exported 2 record(s) to CSV');
  });

  it('should show warning when exporting with no records', () => {
    component.billingRecords.set([]);

    component.exportToCSV();

    expect(mockToastService.warning).toHaveBeenCalledWith('No records to export');
  });

  it('should return correct badge class for each status', () => {
    expect(component.getStatusBadgeClass('pending')).toBe('bg-warning text-dark');
    expect(component.getStatusBadgeClass('approved')).toBe('bg-info text-dark');
    expect(component.getStatusBadgeClass('billed')).toBe('bg-primary');
    expect(component.getStatusBadgeClass('paid')).toBe('bg-success');
    expect(component.getStatusBadgeClass('disputed')).toBe('bg-danger');
    expect(component.getStatusBadgeClass('cancelled')).toBe('bg-secondary');
    expect(component.getStatusBadgeClass('unknown')).toBe('bg-secondary');
  });
});
