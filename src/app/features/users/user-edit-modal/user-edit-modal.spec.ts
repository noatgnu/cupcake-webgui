import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, UserManagementService } from '@noatgnu/cupcake-core';
import { UserEditModal } from './user-edit-modal';

describe('UserEditModal', () => {
  let component: UserEditModal;
  let fixture: ComponentFixture<UserEditModal>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const mockUserService = jasmine.createSpyObj('UserManagementService', ['updateUser']);
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [UserEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: UserManagementService, useValue: mockUserService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserEditModal);
    component = fixture.componentInstance;
    component.user = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      isStaff: false,
      isSuperuser: false,
      isActive: true
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit populates username from user input', () => {
    expect(component.username).toBe('testuser');
  });

  it('close() calls activeModal.dismiss()', () => {
    component.close();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
