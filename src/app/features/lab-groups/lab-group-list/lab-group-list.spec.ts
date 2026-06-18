import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService, LabGroupService } from '@noatgnu/cupcake-core';
import { LabGroupList } from './lab-group-list';

describe('LabGroupList', () => {
  let component: LabGroupList;
  let fixture: ComponentFixture<LabGroupList>;
  let mockLabGroupService: jasmine.SpyObj<LabGroupService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockModalService: jasmine.SpyObj<NgbModal>;
  let currentUserSignal: WritableSignal<any>;

  beforeEach(async () => {
    currentUserSignal = signal<any>(null);

    mockLabGroupService = jasmine.createSpyObj('LabGroupService', ['getLabGroups', 'getLabGroupMembers', 'getMyPendingInvitations']);
    mockLabGroupService.getLabGroups.and.returnValue(of({ count: 0, results: [] }));
    mockLabGroupService.getLabGroupMembers.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
    mockLabGroupService.getMyPendingInvitations.and.returnValue(of([]));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    mockAuthService = jasmine.createSpyObj('AuthService', [], {
      currentUser: currentUserSignal
    });

    mockModalService = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [LabGroupList],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: LabGroupService, useValue: mockLabGroupService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NgbModal, useValue: mockModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LabGroupList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadChildLabGroups() calls LabGroupService.getLabGroups() on init', () => {
    expect(mockLabGroupService.getLabGroups).toHaveBeenCalled();
  });

  it('breadcrumbs() starts as empty array', () => {
    expect(component.breadcrumbs()).toEqual([]);
  });

  it('isStaff() returns false when user is null', () => {
    expect(component.isStaff()).toBeFalse();
  });

  it('loadPendingInvitations() populates pendingInvitations() on init', () => {
    expect(mockLabGroupService.getMyPendingInvitations).toHaveBeenCalled();
    expect(component.pendingInvitations()).toEqual([]);
  });
});
