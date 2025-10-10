import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { StepReagentService } from '@noatgnu/cupcake-red-velvet';
import { ReagentService } from '@noatgnu/cupcake-macaron';
import { of, throwError } from 'rxjs';

import { StepReagentModal } from './step-reagent-modal';

describe('StepReagentModal', () => {
  let component: StepReagentModal;
  let fixture: ComponentFixture<StepReagentModal>;
  let mockStepReagentService: jasmine.SpyObj<StepReagentService>;
  let mockReagentService: jasmine.SpyObj<ReagentService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  const mockReagent = {
    id: 1,
    name: 'Water',
    unit: 'mL',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  };

  const mockReagents = {
    count: 2,
    next: undefined,
    previous: undefined,
    results: [
      mockReagent,
      { id: 2, name: 'Salt', unit: 'g', createdAt: '2024-01-01', updatedAt: '2024-01-01' }
    ]
  };

  const mockStepReagent = {
    id: 1,
    step: 1,
    reagent: 1,
    reagentName: 'Water',
    reagentUnit: 'mL',
    quantity: 100,
    scalable: true,
    scalableFactor: 1.5,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  };

  beforeEach(async () => {
    mockStepReagentService = jasmine.createSpyObj('StepReagentService', [
      'createStepReagent',
      'patchStepReagent'
    ]);
    mockReagentService = jasmine.createSpyObj('ReagentService', [
      'getReagents',
      'getReagent',
      'createReagent'
    ]);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    mockReagentService.getReagents.and.returnValue(of(mockReagents));
    mockReagentService.getReagent.and.returnValue(of(mockReagent));

    await TestBed.configureTestingModule({
      imports: [StepReagentModal],
      providers: [
        { provide: StepReagentService, useValue: mockStepReagentService },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StepReagentModal);
    component = fixture.componentInstance;
    component.stepId = 1;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty values for new step reagent', () => {
    fixture.detectChanges();
    expect(component.reagentForm.value).toEqual({
      reagentName: '',
      reagentUnit: '',
      quantity: 0,
      scalable: false,
      scalableFactor: 1
    });
  });

  it('should initialize form with existing values for editing', () => {
    component.stepReagent = mockStepReagent;
    fixture.detectChanges();
    expect(mockReagentService.getReagent).toHaveBeenCalledWith(1);
  });

  it('should create step reagent when save is called without existing stepReagent', () => {
    const createdStepReagent = { ...mockStepReagent };
    mockStepReagentService.createStepReagent.and.returnValue(of(createdStepReagent));
    mockReagentService.createReagent.and.returnValue(of(mockReagent));

    fixture.detectChanges();
    component.reagentForm.patchValue({
      reagentName: 'Water',
      reagentUnit: 'mL',
      quantity: 100,
      scalable: true,
      scalableFactor: 1.5
    });

    component.save();

    expect(mockToastService.success).toHaveBeenCalledWith('Step reagent created successfully');
    expect(mockActiveModal.close).toHaveBeenCalledWith(createdStepReagent);
  });

  it('should update step reagent when save is called with existing stepReagent', () => {
    const updatedStepReagent = { ...mockStepReagent, quantity: 200 };
    mockStepReagentService.patchStepReagent.and.returnValue(of(updatedStepReagent));

    component.stepReagent = mockStepReagent;
    fixture.detectChanges();
    component.reagentForm.patchValue({
      reagentName: 'Water',
      reagentUnit: 'mL',
      quantity: 200
    });

    component.save();

    expect(mockToastService.success).toHaveBeenCalledWith('Step reagent updated successfully');
    expect(mockActiveModal.close).toHaveBeenCalledWith(updatedStepReagent);
  });

  it('should show error when save is called with invalid form', () => {
    fixture.detectChanges();
    component.save();

    expect(mockToastService.error).toHaveBeenCalledWith('Please fill in required fields');
    expect(mockStepReagentService.createStepReagent).not.toHaveBeenCalled();
  });

  it('should handle create error', () => {
    mockStepReagentService.createStepReagent.and.returnValue(
      throwError(() => new Error('Create failed'))
    );
    mockReagentService.createReagent.and.returnValue(of(mockReagent));

    fixture.detectChanges();
    component.reagentForm.patchValue({
      reagentName: 'Water',
      reagentUnit: 'mL',
      quantity: 100,
      scalable: false,
      scalableFactor: 1
    });

    component.save();

    expect(mockToastService.error).toHaveBeenCalledWith('Failed to create step reagent');
    expect(component.saving).toBe(false);
  });

  it('should handle update error', () => {
    mockStepReagentService.patchStepReagent.and.returnValue(
      throwError(() => new Error('Update failed'))
    );

    component.stepReagent = mockStepReagent;
    fixture.detectChanges();
    component.reagentForm.patchValue({
      reagentName: 'Water',
      reagentUnit: 'mL',
      quantity: 100
    });

    component.save();

    expect(mockToastService.error).toHaveBeenCalledWith('Failed to update step reagent');
    expect(component.saving).toBe(false);
  });

  it('should set scalableFactor to 1 when scalable is unchecked', () => {
    fixture.detectChanges();
    component.reagentForm.patchValue({ scalable: true, scalableFactor: 2 });
    expect(component.reagentForm.value.scalableFactor).toBe(2);

    component.reagentForm.patchValue({ scalable: false });
    expect(component.reagentForm.value.scalableFactor).toBe(1);
  });

  it('should dismiss modal on cancel', () => {
    fixture.detectChanges();
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should format reagent correctly', () => {
    expect(component.formatReagent('Water')).toBe('Water');
    expect(component.formatReagent(mockReagent)).toBe('Water');
  });

  it('should handle select reagent event', () => {
    const event = {
      preventDefault: jasmine.createSpy('preventDefault'),
      item: { name: 'Water', unit: 'mL' }
    };

    fixture.detectChanges();
    component.onSelectReagent(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.reagentForm.value.reagentName).toBe('Water');
    expect(component.reagentForm.value.reagentUnit).toBe('mL');
  });
});
