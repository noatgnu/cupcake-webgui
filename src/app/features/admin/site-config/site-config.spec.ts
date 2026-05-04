import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, SiteConfigService, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { SiteConfig } from './site-config';
import { SidebarControl } from '../../../core/services/sidebar-control';

describe('SiteConfig', () => {
  let component: SiteConfig;
  let fixture: ComponentFixture<SiteConfig>;
  let mockSiteConfigService: jasmine.SpyObj<SiteConfigService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let currentUserSubject: BehaviorSubject<any>;

  const mockConfig = {
    id: 1,
    siteName: 'Test Site',
    primaryColor: '#1976d2',
    showPoweredBy: true,
    allowUserRegistration: false,
    enableOrcidLogin: false,
    bookingDeletionWindowMinutes: 30,
    whisperCppModel: '',
    uiFeaturesWithDefaults: {}
  };

  beforeEach(async () => {
    currentUserSubject = new BehaviorSubject<any>(null);

    mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', [
      'getCurrentConfig',
      'updateConfig',
      'getAvailableWhisperModels',
      'refreshWhisperModels'
    ], {
      siteConfig: signal(mockConfig)
    });
    mockSiteConfigService.getCurrentConfig.and.returnValue(of(mockConfig as any));
    mockSiteConfigService.getAvailableWhisperModels.and.returnValue(of({ models: [], count: 0 }));

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    mockAuthService = jasmine.createSpyObj('AuthService', ['logout', 'getAccessToken'], {
      currentUser: signal(null),
      currentUser$: currentUserSubject.asObservable()
    });

    await TestBed.configureTestingModule({
      imports: [SiteConfig],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: SiteConfigService, useValue: mockSiteConfigService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: SidebarControl, useValue: jasmine.createSpyObj('SidebarControl', ['toggle']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SiteConfig);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadConfig() should call SiteConfigService.getCurrentConfig()', () => {
    expect(mockSiteConfigService.getCurrentConfig).toHaveBeenCalled();
  });

  it('loadConfig() should populate config signal on success', () => {
    expect(component.config()).toEqual(mockConfig as any);
  });

  it('saveConfig() should not call updateConfig when canEdit is false', () => {
    component.canEdit.set(false);
    component.saveConfig();
    expect(mockSiteConfigService.updateConfig).not.toHaveBeenCalled();
    expect(mockToastService.error).toHaveBeenCalledWith('You do not have permission to update site configuration');
  });

  it('saveConfig() should call SiteConfigService.updateConfig() when canEdit is true', () => {
    mockSiteConfigService.updateConfig.and.returnValue(of(mockConfig as any));
    component.canEdit.set(true);
    component.saveConfig();
    expect(mockSiteConfigService.updateConfig).toHaveBeenCalled();
  });

  it('canEdit is true when user is staff', () => {
    currentUserSubject.next({ isStaff: true, isSuperuser: false, username: 'admin' });
    expect(component.canEdit()).toBeTrue();
  });

  it('canEdit is false when user is not staff', () => {
    currentUserSubject.next({ isStaff: false, isSuperuser: false, username: 'user' });
    expect(component.canEdit()).toBeFalse();
  });

  it('updateField() should update formData', () => {
    component.updateField('siteName', 'New Name');
    expect(component.formData().siteName).toBe('New Name');
  });
});
