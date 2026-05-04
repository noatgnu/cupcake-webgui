import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, LabGroupService, UserManagementService } from '@noatgnu/cupcake-core';
import { ReagentService } from '@noatgnu/cupcake-macaron';
import { StoredReagentAccessModal } from './stored-reagent-access-modal';

describe('StoredReagentAccessModal', () => {
  let component: StoredReagentAccessModal;
  let fixture: ComponentFixture<StoredReagentAccessModal>;

  beforeEach(async () => {
    const mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const mockReagentService = jasmine.createSpyObj('ReagentService', ['updateStoredReagent']);
    const mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['getLabGroups']);
    mockLabGroupService.getLabGroups.and.returnValue(of({ count: 0, results: [] }));
    const mockUserService = jasmine.createSpyObj('UserManagementService', ['getUsers']);
    mockUserService.getUsers.and.returnValue(of({ count: 0, results: [] }));
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [StoredReagentAccessModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ReagentService, useValue: mockReagentService },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: UserManagementService, useValue: mockUserService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StoredReagentAccessModal);
    component = fixture.componentInstance;
    component.storedReagent = {
      id: 1,
      reagent: 1,
      reagentName: 'Test Reagent',
      quantity: 100,
      currentQuantity: 100,
      shareable: false,
      accessAll: false,
      notifyOnLowStock: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('allLabGroups starts empty', () => {
    expect(component.allLabGroups()).toEqual([]);
  });

  it('shareable reflects storedReagent.shareable', () => {
    expect(component.shareable()).toBeFalse();
  });
});
