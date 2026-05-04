import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService, UserManagementService } from '@noatgnu/cupcake-core';
import { UserList } from './user-list';

describe('UserList', () => {
  let component: UserList;
  let fixture: ComponentFixture<UserList>;
  let mockUserService: jasmine.SpyObj<UserManagementService>;

  beforeEach(async () => {
    mockUserService = jasmine.createSpyObj('UserManagementService', ['getUsers', 'createUser', 'updateUser', 'deleteUser']);
    mockUserService.getUsers.and.returnValue(of({ count: 0, results: [] }));
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);
    const mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: signal(null)
    });

    await TestBed.configureTestingModule({
      imports: [UserList],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: UserManagementService, useValue: mockUserService },
        { provide: ToastService, useValue: mockToastService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('users signal starts empty', () => {
    expect(component.users()).toEqual([]);
  });

  it('loadUsers calls UserManagementService.getUsers', () => {
    expect(mockUserService.getUsers).toHaveBeenCalled();
  });
});
