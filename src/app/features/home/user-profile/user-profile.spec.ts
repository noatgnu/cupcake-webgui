import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, AuthService, ToastService, UserManagementService } from '@noatgnu/cupcake-core';
import { UserProfile } from './user-profile';

describe('UserProfile', () => {
  let component: UserProfile;
  let fixture: ComponentFixture<UserProfile>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockUserManagementService: jasmine.SpyObj<UserManagementService>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  const mockUser = {
    id: 1,
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    isStaff: false,
    isSuperuser: false
  };

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: signal(mockUser as any)
    });

    mockUserManagementService = jasmine.createSpyObj('UserManagementService', [
      'updateProfile',
      'changePassword',
      'getUserDisplayName',
      'formatDate'
    ]);
    mockUserManagementService.getUserDisplayName.and.returnValue('Test User');
    mockUserManagementService.formatDate.and.returnValue('2024-01-01');

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [UserProfile],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserManagementService, useValue: mockUserManagementService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize profile fields from currentUser on init', () => {
    expect(component.firstName).toBe('Test');
    expect(component.lastName).toBe('User');
    expect(component.email).toBe('test@example.com');
  });

  it('toggleEditMode() toggles editMode signal', () => {
    expect(component.editMode()).toBeFalse();
    component.toggleEditMode();
    expect(component.editMode()).toBeTrue();
    component.toggleEditMode();
    expect(component.editMode()).toBeFalse();
  });

  it('toggleChangePasswordMode() toggles changePasswordMode signal', () => {
    expect(component.changePasswordMode()).toBeFalse();
    component.toggleChangePasswordMode();
    expect(component.changePasswordMode()).toBeTrue();
  });

  it('saveProfile() shows error when email is empty', () => {
    component.email = '';
    component.saveProfile();
    expect(mockToastService.error).toHaveBeenCalledWith('Email is required');
    expect(mockUserManagementService.updateProfile).not.toHaveBeenCalled();
  });

  it('saveProfile() shows error when currentPassword is empty', () => {
    component.email = 'test@example.com';
    component.currentPassword = '';
    component.saveProfile();
    expect(mockToastService.error).toHaveBeenCalledWith('Current password is required to update profile');
  });

  it('saveProfile() calls userManagementService.updateProfile() with valid data', () => {
    const updatedUser = { ...mockUser };
    mockUserManagementService.updateProfile.and.returnValue(of({ user: updatedUser } as any));
    component.email = 'test@example.com';
    component.currentPassword = 'password123';
    component.saveProfile();
    expect(mockUserManagementService.updateProfile).toHaveBeenCalled();
    expect(mockToastService.success).toHaveBeenCalledWith('Profile updated successfully');
  });

  it('changePassword() shows error when passwords do not match', () => {
    component.currentPassword = 'current';
    component.newPassword = 'newpass123';
    component.confirmPassword = 'different123';
    component.changePassword();
    expect(mockToastService.error).toHaveBeenCalledWith('Passwords do not match');
  });

  it('changePassword() shows error when new password too short', () => {
    component.currentPassword = 'current';
    component.newPassword = 'short';
    component.confirmPassword = 'short';
    component.changePassword();
    expect(mockToastService.error).toHaveBeenCalledWith('Password must be at least 8 characters');
  });

  it('changePassword() calls userManagementService.changePassword() with valid data', () => {
    mockUserManagementService.changePassword.and.returnValue(of({ message: 'ok' }));
    component.currentPassword = 'current123';
    component.newPassword = 'newpassword1';
    component.confirmPassword = 'newpassword1';
    component.changePassword();
    expect(mockUserManagementService.changePassword).toHaveBeenCalled();
    expect(mockToastService.success).toHaveBeenCalledWith('Password changed successfully');
  });
});
