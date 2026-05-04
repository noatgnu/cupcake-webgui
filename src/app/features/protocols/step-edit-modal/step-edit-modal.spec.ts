import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ProtocolStepService, StepReagentService } from '@noatgnu/cupcake-red-velvet';
import { StepEditModal } from './step-edit-modal';

describe('StepEditModal', () => {
  let component: StepEditModal;
  let fixture: ComponentFixture<StepEditModal>;
  let mockStepService: jasmine.SpyObj<ProtocolStepService>;
  let mockStepReagentService: jasmine.SpyObj<StepReagentService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockStepService = jasmine.createSpyObj('ProtocolStepService', ['patchProtocolStep']);

    mockStepReagentService = jasmine.createSpyObj('StepReagentService', ['getReagentsByStep']);
    mockStepReagentService.getReagentsByStep.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);

    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [StepEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: ProtocolStepService, useValue: mockStepService },
        { provide: StepReagentService, useValue: mockStepReagentService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StepEditModal);
    component = fixture.componentInstance;
    component.step = { id: 1, stepDescription: 'Test', stepDuration: 60, order: 1, protocol: 1, stepSection: 1 } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should populate form from step on ngOnInit', () => {
    expect(component.stepForm.value.stepDescription).toBe('Test');
    expect(component.stepForm.value.stepDuration).toBe(60);
  });

  it('should call getReagentsByStep on init via loadStepReagents', () => {
    expect(mockStepReagentService.getReagentsByStep).toHaveBeenCalledWith(1);
  });

  it('should dismiss modal when cancel is called', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
