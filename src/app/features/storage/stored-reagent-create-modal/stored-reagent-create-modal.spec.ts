import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StoredReagentCreateModal } from './stored-reagent-create-modal';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { ReagentService, StorageObject } from '@noatgnu/cupcake-macaron';

describe('StoredReagentCreateModal', () => {
  let component: StoredReagentCreateModal;
  let fixture: ComponentFixture<StoredReagentCreateModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockReagentService: jasmine.SpyObj<ReagentService>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    mockReagentService = jasmine.createSpyObj('ReagentService', ['getReagents', 'createReagent', 'createStoredReagent']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [StoredReagentCreateModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: ToastService, useValue: mockToastService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoredReagentCreateModal);
    component = fixture.componentInstance;
    component.storageObject = { id: 1, objectName: 'Test Storage' } as StorageObject;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show error when reagent name is empty', () => {
    component.reagentName = '';
    component.reagentUnit = 'mL';
    component.quantity = 10;
    component.save();
    expect(mockToastService.error).toHaveBeenCalledWith('Please enter a reagent name');
  });

  it('should show error when unit is empty', () => {
    component.reagentName = 'Test Reagent';
    component.reagentUnit = '';
    component.quantity = 10;
    component.save();
    expect(mockToastService.error).toHaveBeenCalledWith('Please select a unit');
  });

  it('should show error when quantity is zero', () => {
    component.reagentName = 'Test Reagent';
    component.reagentUnit = 'mL';
    component.quantity = 0;
    component.save();
    expect(mockToastService.error).toHaveBeenCalledWith('Quantity must be greater than 0');
  });

  it('should create stored reagent with existing reagent', () => {
    mockReagentService.getReagents.and.returnValue(of({
      count: 1,
      results: [{
        id: 1,
        name: 'Test Reagent',
        unit: 'mL',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z'
      }],
      next: undefined,
      previous: undefined
    }));
    mockReagentService.createStoredReagent.and.returnValue(of({ id: 1 } as any));

    component.reagentName = 'Test Reagent';
    component.reagentUnit = 'mL';
    component.quantity = 10;
    component.save();

    expect(mockReagentService.getReagents).toHaveBeenCalledWith({ name: 'Test Reagent', unit: 'mL', limit: 1 });
    expect(mockReagentService.createStoredReagent).toHaveBeenCalled();
  });

  it('should create new reagent when not found', () => {
    mockReagentService.getReagents.and.returnValue(of({ count: 0, results: [], next: undefined, previous: undefined }));
    mockReagentService.createReagent.and.returnValue(of({ id: 2, name: 'New Reagent', unit: 'mL' } as any));
    mockReagentService.createStoredReagent.and.returnValue(of({ id: 1 } as any));

    component.reagentName = 'New Reagent';
    component.reagentUnit = 'mL';
    component.quantity = 10;
    component.save();

    expect(mockReagentService.createReagent).toHaveBeenCalledWith({ name: 'New Reagent', unit: 'mL' });
  });
});
