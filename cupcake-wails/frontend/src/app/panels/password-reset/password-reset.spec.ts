import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PasswordResetComponent } from './password-reset';
import { WailsService } from '../../core/services/wails.service';

describe('PasswordResetComponent', () => {
  let component: PasswordResetComponent;
  let fixture: ComponentFixture<PasswordResetComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;

  beforeEach(async () => {
    mockWailsService = jasmine.createSpyObj('WailsService', [
      'listUsers',
      'resetPassword',
      'closePasswordResetWindow'
    ], {
      isWails: false
    });

    mockWailsService.listUsers.and.resolveTo(['admin', 'user1', 'user2']);
    mockWailsService.resetPassword.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [PasswordResetComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordResetComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load users on init', async () => {
    await component.ngOnInit();
    expect(mockWailsService.listUsers).toHaveBeenCalled();
    expect(component.users()).toEqual(['admin', 'user1', 'user2']);
  });

  it('should select first user by default', async () => {
    await component.ngOnInit();
    expect(component.selectedUser).toBe('admin');
  });

  it('should have empty password fields initially', () => {
    expect(component.newPassword).toBe('');
    expect(component.confirmPassword).toBe('');
  });

  it('should not be resetting initially', () => {
    expect(component.resetting()).toBeFalse();
  });

  it('should not have error initially', () => {
    expect(component.error()).toBeNull();
  });

  it('should not be success initially', () => {
    expect(component.success()).toBeFalse();
  });

  describe('validation', () => {
    beforeEach(async () => {
      await component.ngOnInit();
    });

    it('should be invalid with empty password', () => {
      expect(component.isValid()).toBeFalse();
    });

    it('should be invalid with password mismatch', () => {
      component.newPassword = 'password123';
      component.confirmPassword = 'different';
      expect(component.isValid()).toBeFalse();
    });

    it('should be invalid with short password', () => {
      component.newPassword = 'short';
      component.confirmPassword = 'short';
      expect(component.isValid()).toBeFalse();
    });

    it('should be valid with correct data', () => {
      component.newPassword = 'password123';
      component.confirmPassword = 'password123';
      expect(component.isValid()).toBeTrue();
    });
  });

  describe('resetPassword', () => {
    beforeEach(async () => {
      await component.ngOnInit();
    });

    it('should set error for password mismatch', async () => {
      component.newPassword = 'password123';
      component.confirmPassword = 'different';

      await component.resetPassword();

      expect(component.error()).toBe('Passwords do not match');
    });

    it('should set error for short password', async () => {
      component.newPassword = 'short';
      component.confirmPassword = 'short';

      await component.resetPassword();

      expect(component.error()).toBe('Password must be at least 8 characters');
    });

    it('should call resetPassword with valid data', async () => {
      component.newPassword = 'password123';
      component.confirmPassword = 'password123';

      await component.resetPassword();

      expect(mockWailsService.resetPassword).toHaveBeenCalledWith('admin', 'password123');
    });

    it('should set success on successful reset', async () => {
      component.newPassword = 'password123';
      component.confirmPassword = 'password123';

      await component.resetPassword();

      expect(component.success()).toBeTrue();
    });

    it('should clear password fields on success', async () => {
      component.newPassword = 'password123';
      component.confirmPassword = 'password123';

      await component.resetPassword();

      expect(component.newPassword).toBe('');
      expect(component.confirmPassword).toBe('');
    });

    it('should handle reset error', async () => {
      mockWailsService.resetPassword.and.rejectWith(new Error('Reset failed'));

      component.newPassword = 'password123';
      component.confirmPassword = 'password123';

      await component.resetPassword();

      expect(component.error()).toContain('Failed to reset password');
    });
  });

  describe('close', () => {
    it('should call closePasswordResetWindow', () => {
      component.close();
      expect(mockWailsService.closePasswordResetWindow).toHaveBeenCalled();
    });
  });

  describe('loadUsers error', () => {
    it('should set error when listUsers fails', async () => {
      mockWailsService.listUsers.and.rejectWith(new Error('Load failed'));

      await component.loadUsers();

      expect(component.error()).toContain('Failed to load users');
    });
  });
});
