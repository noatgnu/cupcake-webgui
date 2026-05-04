import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { InstrumentService, InstrumentUsageService, InstrumentPermissionService } from '@noatgnu/cupcake-macaron';
import { InstrumentBookingAnnotation } from './instrument-booking-annotation';

describe('InstrumentBookingAnnotation', () => {
  let component: InstrumentBookingAnnotation;
  let fixture: ComponentFixture<InstrumentBookingAnnotation>;
  let mockInstrumentService: jasmine.SpyObj<InstrumentService>;
  let mockInstrumentUsageService: jasmine.SpyObj<InstrumentUsageService>;
  let mockInstrumentPermissionService: jasmine.SpyObj<InstrumentPermissionService>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockInstrumentService = jasmine.createSpyObj('InstrumentService', ['getInstruments']);
    mockInstrumentService.getInstruments.and.returnValue(of({ count: 0, results: [] }));

    mockInstrumentUsageService = jasmine.createSpyObj('InstrumentUsageService', ['getInstrumentUsage']);
    mockInstrumentUsageService.getInstrumentUsage.and.returnValue(of({ count: 0, results: [] }));

    mockInstrumentPermissionService = jasmine.createSpyObj('InstrumentPermissionService', ['getBookingPermissions']);
    mockInstrumentPermissionService.getBookingPermissions.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [InstrumentBookingAnnotation],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: InstrumentUsageService, useValue: mockInstrumentUsageService },
        { provide: InstrumentPermissionService, useValue: mockInstrumentPermissionService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InstrumentBookingAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty availableInstruments signal', () => {
    expect(component.availableInstruments()).toEqual([]);
  });

  it('should call getBookingPermissions on init via loadAvailableInstruments', () => {
    expect(mockInstrumentPermissionService.getBookingPermissions).toHaveBeenCalled();
  });
});
