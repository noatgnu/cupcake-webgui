import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { BillingRecordService, BillingStatus } from '@noatgnu/cupcake-salted-caramel';
import type { BillingRecord } from '@noatgnu/cupcake-salted-caramel';
import { BillingRecords } from './billing-records';
import { SidebarControl } from '../../../core/services/sidebar-control';

describe('BillingRecords', () => {
  let component: BillingRecords;
  let fixture: ComponentFixture<BillingRecords>;
  let mockBillingRecordService: jasmine.SpyObj<BillingRecordService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;
  let currentUserSignal: WritableSignal<any>;

  const mockRecords: BillingRecord[] = [
    {
      id: 'rec-1',
      username: 'User 1',
      userEmail: 'u1@example.com',
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
      id: 'rec-2',
      username: 'User 2',
      userEmail: 'u2@example.com',
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

  beforeEach(async () => {
    currentUserSignal = signal<any>(null);

    mockBillingRecordService = jasmine.createSpyObj('BillingRecordService', [
      'getBillingRecords',
      'approveBillingRecord'
    ]);
    mockBillingRecordService.getBillingRecords.and.returnValue(of({ count: 2, results: mockRecords }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info', 'show']);

    mockAuthService = jasmine.createSpyObj('AuthService', [], {
      currentUser: currentUserSignal
    });

    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [BillingRecords],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: BillingRecordService, useValue: mockBillingRecordService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: SidebarControl, useValue: jasmine.createSpyObj('SidebarControl', ['toggle']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BillingRecords);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadBillingRecords() should call BillingRecordService.getBillingRecords()', () => {
    expect(mockBillingRecordService.getBillingRecords).toHaveBeenCalled();
  });

  it('should populate billingRecords and total on init', () => {
    expect(component.billingRecords()).toEqual(mockRecords);
    expect(component.total()).toBe(2);
    expect(component.loading()).toBeFalse();
  });

  it('isAdmin() returns false when currentUser is null', () => {
    expect(component.isAdmin()).toBeFalse();
  });

  it('isAdmin() returns true when currentUser is staff', () => {
    currentUserSignal.set({ isStaff: true, isSuperuser: false });
    expect(component.isAdmin()).toBeTrue();
  });

  it('clearFilters() should reset all filter signals and page', () => {
    component.searchQuery.set('test');
    component.statusFilter.set(BillingStatus.PENDING);
    component.costCenterFilter.set('CC-001');
    component.startDate.set('2024-01-01');
    component.endDate.set('2024-01-31');
    component.page.set(3);
    component.clearFilters();
    expect(component.searchQuery()).toBe('');
    expect(component.statusFilter()).toBe('');
    expect(component.costCenterFilter()).toBe('');
    expect(component.startDate()).toBe('');
    expect(component.endDate()).toBe('');
    expect(component.page()).toBe(1);
  });

  it('selectAllRecords() should select all billingRecord IDs', () => {
    component.billingRecords.set(mockRecords);
    component.selectAllRecords();
    expect(component.selectedRecords().size).toBe(2);
    expect(component.selectedRecords().has('rec-1')).toBeTrue();
    expect(component.selectedRecords().has('rec-2')).toBeTrue();
  });

  it('deselectAllRecords() should clear selection', () => {
    component.selectedRecords.set(new Set(['rec-1', 'rec-2']));
    component.deselectAllRecords();
    expect(component.selectedRecords().size).toBe(0);
  });

  it('bulkApprove() shows warning when no records selected', () => {
    component.bulkApprove();
    expect(mockToastService.warning).toHaveBeenCalledWith('Please select at least one record to approve');
  });

  it('exportToCSV() shows warning when no records', () => {
    component.billingRecords.set([]);
    component.exportToCSV();
    expect(mockToastService.warning).toHaveBeenCalledWith('No records to export');
  });

  it('toggleAdvancedFilters() toggles showAdvancedFilters', () => {
    expect(component.showAdvancedFilters()).toBeFalse();
    component.toggleAdvancedFilters();
    expect(component.showAdvancedFilters()).toBeTrue();
  });

  it('getStatusBadgeClass() returns correct class for pending', () => {
    expect(component.getStatusBadgeClass('pending')).toBe('bg-warning text-dark');
    expect(component.getStatusBadgeClass('paid')).toBe('bg-success');
    expect(component.getStatusBadgeClass('unknown')).toBe('bg-secondary');
  });
});
