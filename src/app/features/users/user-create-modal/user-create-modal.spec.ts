import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, UserManagementService } from '@noatgnu/cupcake-core';
import { UserCreateModal } from './user-create-modal';

describe('UserCreateModal', () => {
  let component: UserCreateModal;
  let fixture: ComponentFixture<UserCreateModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const mockUserService = jasmine.createSpyObj('UserManagementService', ['createUser']);
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [UserCreateModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: UserManagementService, useValue: mockUserService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('save() shows error when username is empty', () => {
    component.username = '';
    component.save();
    expect(mockToastService.error).toHaveBeenCalled();
  });

  it('close() calls activeModal.dismiss()', () => {
    component.close();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
