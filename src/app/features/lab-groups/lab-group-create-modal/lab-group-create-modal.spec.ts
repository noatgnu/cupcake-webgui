import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService, LabGroupService } from '@noatgnu/cupcake-core';
import { LabGroupCreateModal } from './lab-group-create-modal';

describe('LabGroupCreateModal', () => {
  let component: LabGroupCreateModal;
  let fixture: ComponentFixture<LabGroupCreateModal>;
  let mockLabGroupService: jasmine.SpyObj<LabGroupService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let currentUserSignal: WritableSignal<any>;

  beforeEach(async () => {
    currentUserSignal = signal<any>(null);

    mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['createLabGroup']);
    mockLabGroupService.createLabGroup.and.returnValue(of({ id: 1, name: 'Test' } as any));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    mockAuthService = jasmine.createSpyObj('AuthService', [], {
      currentUser: currentUserSignal
    });

    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [LabGroupCreateModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LabGroupCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('save() shows toast error when name is empty', () => {
    component.name = '';
    component.save();
    expect(mockToastService.error).toHaveBeenCalledWith('Lab group name is required');
    expect(mockLabGroupService.createLabGroup).not.toHaveBeenCalled();
  });

  it('save() calls createLabGroup() when name is set', () => {
    component.name = 'New Group';
    component.save();
    expect(mockLabGroupService.createLabGroup).toHaveBeenCalled();
  });

  it('close() calls NgbActiveModal.dismiss()', () => {
    component.close();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
