import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ThemeService, AuthService, SiteConfigService, DemoModeService, AsyncTaskMonitorService } from '@noatgnu/cupcake-core';
import { NotificationService, CommunicationWebSocketService, MessageThreadService } from '@noatgnu/cupcake-mint-chocolate';
import { Sidebar } from './sidebar';
import { SidebarControl } from '../../services/sidebar-control';
import { DropdownCoordinator } from '../../../shared/services/dropdown-coordinator';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;
  let mockThemeService: jasmine.SpyObj<ThemeService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockSiteConfigService: jasmine.SpyObj<SiteConfigService>;
  let mockDemoModeService: jasmine.SpyObj<DemoModeService>;
  let mockSidebarControl: jasmine.SpyObj<SidebarControl>;
  let currentUserSignal: WritableSignal<any>;
  let toggleSubject: Subject<void>;

  beforeEach(async () => {
    toggleSubject = new Subject<void>();
    currentUserSignal = signal<any>(null);

    mockThemeService = jasmine.createSpyObj('ThemeService', ['toggleTheme', 'getThemeIcon', 'getThemeLabel'], {
      isDark: signal(false)
    });

    mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: currentUserSignal
    });
    mockAuthService.logout.and.returnValue(of(null));

    mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getSiteName'], {
      siteConfig: signal({ uiFeaturesWithDefaults: {} })
    });

    mockDemoModeService = jasmine.createSpyObj('DemoModeService', [], {
      demoMode: signal({ isActive: false })
    });

    mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle'], {
      toggle$: toggleSubject.asObservable()
    });

    const mockNotificationService = jasmine.createSpyObj('NotificationService', ['getUnreadNotifications', 'markNotificationRead']);
    mockNotificationService.getUnreadNotifications.and.returnValue(of({ count: 0, results: [] }));

    const mockWsService = jasmine.createSpyObj('CommunicationWebSocketService', ['connect', 'disconnect'], {
      newNotifications$: new Subject<any>().asObservable()
    });

    const mockMessageThreadService = jasmine.createSpyObj('MessageThreadService', ['getActiveThreads']);
    mockMessageThreadService.getActiveThreads.and.returnValue(of({ count: 0, results: [] }));

    const mockAsyncTaskMonitor = jasmine.createSpyObj('AsyncTaskMonitorService', ['startRealtimeUpdates', 'stopRealtimeUpdates', 'cancelTask'], {
      tasks: signal([]),
      activeTasks: signal([])
    });

    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: ThemeService, useValue: mockThemeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: SiteConfigService, useValue: mockSiteConfigService },
        { provide: DemoModeService, useValue: mockDemoModeService },
        { provide: SidebarControl, useValue: mockSidebarControl },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: CommunicationWebSocketService, useValue: mockWsService },
        { provide: MessageThreadService, useValue: mockMessageThreadService },
        { provide: AsyncTaskMonitorService, useValue: mockAsyncTaskMonitor }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isCollapsed starts as false', () => {
    expect(component.isCollapsed()).toBeFalse();
  });

  it('isDemoMode starts as false', () => {
    expect(component.isDemoMode()).toBeFalse();
  });

  it('toggleTheme() calls ThemeService.toggleTheme()', () => {
    component.toggleTheme();
    expect(mockThemeService.toggleTheme).toHaveBeenCalled();
  });

  it('logout() calls AuthService.logout()', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('isAdmin() returns false when currentUser is null', () => {
    expect(component.isAdmin()).toBeFalse();
  });

  it('isAdmin() returns true when currentUser is staff', () => {
    currentUserSignal.set({ isStaff: true, isSuperuser: false });
    expect(component.isAdmin()).toBeTrue();
  });

  it('isSuperuser() returns false when currentUser is null', () => {
    expect(component.isSuperuser()).toBeFalse();
  });
});
