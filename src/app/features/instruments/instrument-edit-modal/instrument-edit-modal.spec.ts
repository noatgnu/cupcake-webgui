import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { InstrumentService } from '@noatgnu/cupcake-macaron';
import { InstrumentEditModal } from './instrument-edit-modal';

describe('InstrumentEditModal', () => {
  let component: InstrumentEditModal;
  let fixture: ComponentFixture<InstrumentEditModal>;
  let mockInstrumentService: jasmine.SpyObj<InstrumentService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockInstrumentService = jasmine.createSpyObj('InstrumentService', ['createInstrument', 'updateInstrument']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [InstrumentEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InstrumentEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isEdit starts as false in create mode', () => {
    expect(component.isEdit).toBeFalse();
  });

  it('save() shows error when instrumentName is empty', () => {
    component.instrumentName = '';
    component.save();
    expect(mockToastService.error).toHaveBeenCalledWith('Instrument name is required');
    expect(mockInstrumentService.createInstrument).not.toHaveBeenCalled();
  });

  it('save() calls InstrumentService.createInstrument() in create mode', () => {
    mockInstrumentService.createInstrument.and.returnValue(of({ id: 1, instrumentName: 'Test' } as any));
    component.instrumentName = 'Test Instrument';
    component.save();
    expect(mockInstrumentService.createInstrument).toHaveBeenCalled();
  });

  it('cancel() calls NgbActiveModal.dismiss()', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
