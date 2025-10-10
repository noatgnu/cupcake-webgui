import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepCreateModal } from './step-create-modal';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProtocolStepService } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { of, throwError } from 'rxjs';

describe('StepCreateModal', () => {
  let component: StepCreateModal;
  let fixture: ComponentFixture<StepCreateModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockStepService: jasmine.SpyObj<ProtocolStepService>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    mockStepService = jasmine.createSpyObj('ProtocolStepService', ['createProtocolStep']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [StepCreateModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ProtocolStepService, useValue: mockStepService },
        { provide: ToastService, useValue: mockToastService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepCreateModal);
    component = fixture.componentInstance;
    component.protocolId = 1;
    component.sectionId = 1;
    component.order = 0;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty form', () => {
    expect(component.stepForm.get('stepDescription')?.value).toBe('');
    expect(component.stepForm.get('stepDuration')?.value).toBe(0);
  });

  it('should validate required fields', () => {
    expect(component.stepForm.valid).toBeFalse();
    component.stepForm.patchValue({ stepDescription: 'Test step' });
    expect(component.stepForm.valid).toBeTrue();
  });

  it('should create step on valid form submission', () => {
    const mockStep = { id: 1, stepDescription: 'Test step', stepDuration: 60 };
    mockStepService.createProtocolStep.and.returnValue(of(mockStep as any));

    component.stepForm.patchValue({
      stepDescription: 'Test step',
      stepDuration: 60
    });

    component.createStep();

    expect(mockStepService.createProtocolStep).toHaveBeenCalledWith({
      protocol: 1,
      stepSection: 1,
      stepDescription: 'Test step',
      stepDuration: 60,
      order: 0
    });
    expect(mockToastService.success).toHaveBeenCalledWith('Step created successfully');
    expect(mockActiveModal.close).toHaveBeenCalledWith(mockStep);
  });

  it('should show error on invalid form submission', () => {
    component.createStep();
    expect(mockToastService.error).toHaveBeenCalledWith('Please fill in required fields');
    expect(mockStepService.createProtocolStep).not.toHaveBeenCalled();
  });

  it('should handle creation error', () => {
    mockStepService.createProtocolStep.and.returnValue(throwError(() => new Error('API Error')));

    component.stepForm.patchValue({ stepDescription: 'Test step' });
    component.createStep();

    expect(mockToastService.error).toHaveBeenCalledWith('Failed to create step');
    expect(component.saving).toBeFalse();
  });

  it('should dismiss modal on cancel', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
