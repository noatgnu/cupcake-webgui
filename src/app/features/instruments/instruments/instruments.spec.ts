import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { InstrumentService, InstrumentPermissionService, InstrumentUsageService, MaintenanceService } from '@noatgnu/cupcake-macaron';
import { Instruments } from './instruments';
import { SidebarControl } from '../../../core/services/sidebar-control';

describe('Instruments', () => {
  let component: Instruments;
  let fixture: ComponentFixture<Instruments>;
  let mockInstrumentService: jasmine.SpyObj<InstrumentService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let currentUserSignal: WritableSignal<any>;

  beforeEach(async () => {
    currentUserSignal = signal<any>(null);

    mockInstrumentService = jasmine.createSpyObj('InstrumentService', [
      'getInstruments', 'getInstrument', 'getInstrumentMetadata', 'createInstrument', 'updateInstrument', 'deleteInstrument'
    ]);
    mockInstrumentService.getInstruments.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    const mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: currentUserSignal
    });

    const mockPermissionService = jasmine.createSpyObj('InstrumentPermissionService', [
      'getInstrumentPermissions', 'createInstrumentPermission', 'updateInstrumentPermission'
    ]);
    mockPermissionService.getInstrumentPermissions.and.returnValue(of({ count: 0, results: [] }));

    const mockUsageService = jasmine.createSpyObj('InstrumentUsageService', ['getInstrumentUsage']);
    mockUsageService.getInstrumentUsage.and.returnValue(of({ count: 0, results: [] }));

    const mockMaintenanceService = jasmine.createSpyObj('MaintenanceService', ['getMaintenanceLogs']);
    mockMaintenanceService.getMaintenanceLogs.and.returnValue(of({ count: 0, results: [] }));

    const mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle']);

    await TestBed.configureTestingModule({
      imports: [Instruments],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: InstrumentPermissionService, useValue: mockPermissionService },
        { provide: InstrumentUsageService, useValue: mockUsageService },
        { provide: MaintenanceService, useValue: mockMaintenanceService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: SidebarControl, useValue: mockSidebarControl }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Instruments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadInstruments() calls InstrumentService.getInstruments() on init', () => {
    expect(mockInstrumentService.getInstruments).toHaveBeenCalled();
  });

  it('activeTab starts as overview', () => {
    expect(component.activeTab()).toBe('overview');
  });

  it('isStaff returns false when currentUser is null', () => {
    expect(component.isStaff()).toBeFalse();
  });

  it('isStaff returns true when currentUser is staff', () => {
    currentUserSignal.set({ isStaff: true, isSuperuser: false, id: 1 });
    expect(component.isStaff()).toBeTrue();
  });
});
