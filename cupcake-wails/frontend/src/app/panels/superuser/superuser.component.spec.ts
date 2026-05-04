import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SuperuserComponent } from './superuser.component';
import { WailsService } from '../../core/services/wails.service';

describe('SuperuserComponent', () => {
  let component: SuperuserComponent;
  let fixture: ComponentFixture<SuperuserComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;

  beforeEach(async () => {
    mockWailsService = jasmine.createSpyObj('WailsService', [
      'createSuperuser',
      'dismissSuperuserCreation'
    ], {
      isWails: false
    });

    mockWailsService.createSuperuser.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [SuperuserComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SuperuserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have empty form fields initially', () => {
    expect(component.username).toBe('');
    expect(component.email).toBe('');
    expect(component.password).toBe('');
    expect(component.confirmPassword).toBe('');
  });

  it('should not be creating initially', () => {
    expect(component.creating()).toBeFalse();
  });

  it('should not have error initially', () => {
    expect(component.error()).toBeNull();
  });

  it('should not be success initially', () => {
    expect(component.success()).toBeFalse();
  });

  describe('validation', () => {
    it('should be invalid with empty fields', () => {
      expect(component.isValid()).toBeFalse();
    });

    it('should be invalid with password mismatch', () => {
      component.username = 'admin';
      component.email = 'admin@test.com';
      component.password = 'password123';
      component.confirmPassword = 'different';
      expect(component.isValid()).toBeFalse();
    });

    it('should be invalid with short password', () => {
      component.username = 'admin';
      component.email = 'admin@test.com';
      component.password = 'short';
      component.confirmPassword = 'short';
      expect(component.isValid()).toBeFalse();
    });

    it('should be valid with correct data', () => {
      component.username = 'admin';
      component.email = 'admin@test.com';
      component.password = 'password123';
      component.confirmPassword = 'password123';
      expect(component.isValid()).toBeTrue();
    });
  });

  describe('create', () => {
    it('should set error for password mismatch', async () => {
      component.username = 'admin';
      component.email = 'admin@test.com';
      component.password = 'password123';
      component.confirmPassword = 'different';

      await component.create();

      expect(component.error()).toBe('Passwords do not match');
    });

    it('should set error for short password', async () => {
      component.username = 'admin';
      component.email = 'admin@test.com';
      component.password = 'short';
      component.confirmPassword = 'short';

      await component.create();

      expect(component.error()).toBe('Password too short');
    });

    it('should call createSuperuser with valid data', async () => {
      component.username = 'admin';
      component.email = 'admin@test.com';
      component.password = 'password123';
      component.confirmPassword = 'password123';

      await component.create();

      expect(mockWailsService.createSuperuser).toHaveBeenCalledWith('admin', 'admin@test.com', 'password123');
    });

    it('should set success on successful creation', async () => {
      component.username = 'admin';
      component.email = 'admin@test.com';
      component.password = 'password123';
      component.confirmPassword = 'password123';

      await component.create();

      expect(component.success()).toBeTrue();
    });

    it('should handle creation error', async () => {
      mockWailsService.createSuperuser.and.rejectWith(new Error('Creation failed'));

      component.username = 'admin';
      component.email = 'admin@test.com';
      component.password = 'password123';
      component.confirmPassword = 'password123';

      await component.create();

      expect(component.error()).toContain('Provisioning failed');
    });
  });

  describe('skip', () => {
    it('should call dismissSuperuserCreation', () => {
      component.skip();
      expect(mockWailsService.dismissSuperuserCreation).toHaveBeenCalled();
    });
  });
});
