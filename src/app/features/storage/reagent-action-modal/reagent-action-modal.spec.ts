import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { ReagentActionService, ActionType } from '@noatgnu/cupcake-macaron';
import type { StoredReagent } from '@noatgnu/cupcake-macaron';
import { of } from 'rxjs';
import { ReagentActionModal } from './reagent-action-modal';

describe('ReagentActionModal', () => {
  let component: ReagentActionModal;
  let fixture: ComponentFixture<ReagentActionModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockReagentActionService: jasmine.SpyObj<ReagentActionService>;

  const mockStoredReagent: StoredReagent = {
    id: 1,
    reagent: 1,
    reagentName: 'Test Reagent',
    reagentUnit: 'mL',
    currentQuantity: 100,
    quantity: 100,
    notes: '',
    expirationDate: '',
    lowStockThreshold: undefined,
    notifyOnLowStock: false,
    shareable: true,
    accessAll: true,
    storageObject: 1,
    storageObjectName: 'Test Storage',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  };

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error']);
    mockReagentActionService = jasmine.createSpyObj('ReagentActionService', ['createReagentAction']);

    await TestBed.configureTestingModule({
      imports: [ReagentActionModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ToastService, useValue: mockToastService },
        { provide: ReagentActionService, useValue: mockReagentActionService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReagentActionModal);
    component = fixture.componentInstance;
    component.storedReagent = mockStoredReagent;
    component.actionType = ActionType.ADD;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return correct title for ADD action', () => {
    component.actionType = ActionType.ADD;
    expect(component.getTitle()).toBe('Add Quantity');
  });

  it('should return correct title for RESERVE action', () => {
    component.actionType = ActionType.RESERVE;
    expect(component.getTitle()).toBe('Reserve Quantity');
  });

  it('should save reagent action successfully', () => {
    component.quantity = 10;
    component.notes = 'Test notes';
    const mockReagentAction = {
      id: 1,
      reagent: mockStoredReagent.reagent,
      actionType: ActionType.ADD,
      quantity: 10,
      notes: 'Test notes',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z'
    };
    mockReagentActionService.createReagentAction.and.returnValue(of(mockReagentAction));

    component.save();

    expect(mockReagentActionService.createReagentAction).toHaveBeenCalledWith({
      reagent: mockStoredReagent.reagent,
      actionType: ActionType.ADD,
      quantity: 10,
      notes: 'Test notes'
    });
    expect(mockToastService.success).toHaveBeenCalled();
    expect(mockActiveModal.close).toHaveBeenCalledWith(true);
  });

  it('should show error when quantity is zero', () => {
    component.quantity = 0;

    component.save();

    expect(mockToastService.error).toHaveBeenCalledWith('Quantity must be greater than 0');
    expect(mockReagentActionService.createReagentAction).not.toHaveBeenCalled();
  });

  it('should cancel and dismiss modal', () => {
    component.cancel();

    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
