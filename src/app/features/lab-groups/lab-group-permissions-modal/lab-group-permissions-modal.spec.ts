import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService, LabGroupService } from '@noatgnu/cupcake-core';
import { LabGroupPermissionsModal } from './lab-group-permissions-modal';

describe('LabGroupPermissionsModal', () => {
  let component: LabGroupPermissionsModal;
  let fixture: ComponentFixture<LabGroupPermissionsModal>;
  let mockLabGroupService: jasmine.SpyObj<LabGroupService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;
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

    mockLabGroupService = jasmine.createSpyObj('LabGroupService', [
      'getLabGroupMembers',
      'getLabGroupPermissionsForLabGroup'
    ]);
    mockLabGroupService.getLabGroupMembers.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
    mockLabGroupService.getLabGroupPermissionsForLabGroup.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    mockAuthService = jasmine.createSpyObj('AuthService', [], {
      currentUser: currentUserSignal
    });

    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [LabGroupPermissionsModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LabGroupPermissionsModal);
    component = fixture.componentInstance;
    component.labGroup = mockLabGroup;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadMembersWithPermissions() calls LabGroupService.getLabGroupMembers()', () => {
    expect(mockLabGroupService.getLabGroupMembers).toHaveBeenCalledWith(1, jasmine.objectContaining({ limit: 1000 }));
  });

  it('members() starts empty after init', () => {
    expect(component.members()).toEqual([]);
  });
});
