import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService, LabGroupService } from '@noatgnu/cupcake-core';
import { LabGroupEditModal } from './lab-group-edit-modal';

describe('LabGroupEditModal', () => {
  let component: LabGroupEditModal;
  let fixture: ComponentFixture<LabGroupEditModal>;
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

    mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['updateLabGroup']);
    mockLabGroupService.updateLabGroup.and.returnValue(of(mockLabGroup));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    mockAuthService = jasmine.createSpyObj('AuthService', [], {
      currentUser: currentUserSignal
    });

    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [LabGroupEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbActiveModal, useValue: mockActiveModal }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LabGroupEditModal);
    component = fixture.componentInstance;
    component.labGroup = mockLabGroup;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit() populates name from labGroup', () => {
    expect(component.name).toBe('Test Group');
  });

  it('save() calls LabGroupService.updateLabGroup()', () => {
    component.name = 'Updated Group';
    component.save();
    expect(mockLabGroupService.updateLabGroup).toHaveBeenCalledWith(1, jasmine.objectContaining({ name: 'Updated Group' }));
  });
});
