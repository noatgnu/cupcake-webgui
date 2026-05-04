import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { InstrumentUsageService } from '@noatgnu/cupcake-macaron';
import { InstrumentUsageModal } from './instrument-usage-modal';

describe('InstrumentUsageModal', () => {
  let component: InstrumentUsageModal;
  let fixture: ComponentFixture<InstrumentUsageModal>;
  let mockUsageService: jasmine.SpyObj<InstrumentUsageService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  const mockInstrument = { id: 1, instrumentName: 'Test Instrument' } as any;

  beforeEach(async () => {
    mockUsageService = jasmine.createSpyObj('InstrumentUsageService', ['createInstrumentUsage', 'updateInstrumentUsage']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [InstrumentUsageModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: InstrumentUsageService, useValue: mockUsageService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InstrumentUsageModal);
    component = fixture.componentInstance;
    component.instrument = mockInstrument;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isEdit starts as false in create mode', () => {
    expect(component.isEdit).toBeFalse();
  });

  it('save() shows error when timeStarted is empty', () => {
    component.timeStarted = '';
    component.save();
    expect(mockToastService.error).toHaveBeenCalledWith('Start time is required');
  });

  it('save() calls InstrumentUsageService.createInstrumentUsage() in create mode', () => {
    mockUsageService.createInstrumentUsage.and.returnValue(of({ id: 1 } as any));
    component.timeStarted = '2024-01-01T10:00';
    component.save();
    expect(mockUsageService.createInstrumentUsage).toHaveBeenCalled();
  });
});
