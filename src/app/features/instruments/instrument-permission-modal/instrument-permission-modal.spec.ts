import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, UserManagementService } from '@noatgnu/cupcake-core';
import { InstrumentPermissionService } from '@noatgnu/cupcake-macaron';
import { InstrumentPermissionModal } from './instrument-permission-modal';

describe('InstrumentPermissionModal', () => {
  let component: InstrumentPermissionModal;
  let fixture: ComponentFixture<InstrumentPermissionModal>;
  let mockPermissionService: jasmine.SpyObj<InstrumentPermissionService>;
  let mockUserService: jasmine.SpyObj<UserManagementService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  const mockInstrument = { id: 1, instrumentName: 'Test Instrument' } as any;

  beforeEach(async () => {
    mockPermissionService = jasmine.createSpyObj('InstrumentPermissionService', [
      'getInstrumentPermissions', 'createInstrumentPermission', 'updateInstrumentPermission', 'deleteInstrumentPermission'
    ]);
    mockPermissionService.getInstrumentPermissions.and.returnValue(of({ count: 0, results: [] }));

    mockUserService = jasmine.createSpyObj('UserManagementService', ['getUsers']);
    mockUserService.getUsers.and.returnValue(of({ count: 0, results: [] }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [InstrumentPermissionModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: InstrumentPermissionService, useValue: mockPermissionService },
        { provide: UserManagementService, useValue: mockUserService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InstrumentPermissionModal);
    component = fixture.componentInstance;
    component.instrument = mockInstrument;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadUsersWithPermissions() calls UserManagementService.getUsers()', () => {
    expect(mockUserService.getUsers).toHaveBeenCalled();
  });

  it('users signal starts as empty array', () => {
    expect(component.users()).toEqual([]);
  });

  it('loading signal is false after init completes', () => {
    expect(component.loading()).toBeFalse();
  });
});
