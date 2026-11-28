import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService, LabGroupService, UserManagementService } from '@noatgnu/cupcake-core';
import { LabGroupInviteModal } from './lab-group-invite-modal';

describe('LabGroupInviteModal', () => {
  let component: LabGroupInviteModal;
  let fixture: ComponentFixture<LabGroupInviteModal>;
  let mockLabGroupService: jasmine.SpyObj<LabGroupService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
  let mockUserManagementService: jasmine.SpyObj<UserManagementService>;
  let currentUserSignal: WritableSignal<any>;

  const mockLabGroup = {
    id: 1,
    name: 'Test Group',
    description: 'desc',
    allowMemberInvites: true,
    allowProcessJobs: false,
    isActive: true
  } as any;

  beforeEach(async () => {
    currentUserSignal = signal<any>(null);

    mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['inviteUserToLabGroup', 'addMemberToLabGroup']);
    mockLabGroupService.inviteUserToLabGroup.and.returnValue(of({} as any));
    mockLabGroupService.addMemberToLabGroup.and.returnValue(of({ message: 'added' }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    mockAuthService = jasmine.createSpyObj('AuthService', [], {
      currentUser: currentUserSignal
    });

    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    mockUserManagementService = jasmine.createSpyObj('UserManagementService', ['getUsers', 'getUserDisplayName']);
    mockUserManagementService.getUsers.and.returnValue(of({ count: 0, results: [] }));
    mockUserManagementService.getUserDisplayName.and.returnValue('');

    await TestBed.configureTestingModule({
      imports: [LabGroupInviteModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: UserManagementService, useValue: mockUserManagementService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LabGroupInviteModal);
    component = fixture.componentInstance;
    component.labGroup = mockLabGroup;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('searchUsers() calls UserManagementService.getUsers() on init', () => {
    expect(mockUserManagementService.getUsers).toHaveBeenCalled();
  });

  it('users() starts empty', () => {
    expect(component.users()).toEqual([]);
  });

  it('adds the user straight away when staff choose them', () => {
    component.isStaff = true;
    component.labGroup = { id: 3, name: 'Proteomics core' } as any;
    component.selectedUser = { id: 9, email: 'grace@example.org' } as any;

    component.inviteOrAddUser();

    expect(mockLabGroupService.addMemberToLabGroup).toHaveBeenCalledWith(3, 9);
    expect(mockLabGroupService.inviteUserToLabGroup).not.toHaveBeenCalled();
  });

  it('sends an invitation when a member chooses someone', () => {
    component.isStaff = false;
    component.labGroup = { id: 3, name: 'Proteomics core' } as any;
    component.selectedUser = { id: 9, email: 'grace@example.org' } as any;

    component.inviteOrAddUser();

    expect(mockLabGroupService.inviteUserToLabGroup).toHaveBeenCalledWith(3, { labGroup: 3, invitedEmail: 'grace@example.org' });
    expect(mockLabGroupService.addMemberToLabGroup).not.toHaveBeenCalled();
  });
});
