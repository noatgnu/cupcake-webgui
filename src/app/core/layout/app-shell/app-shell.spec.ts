import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ThemeService, AuthService, SiteConfigService, DemoModeService, AsyncTaskMonitorService } from '@noatgnu/cupcake-core';
import { NotificationService, CommunicationWebSocketService, MessageThreadService } from '@noatgnu/cupcake-mint-chocolate';
import { AppShell } from './app-shell';
import { SidebarControl } from '../../services/sidebar-control';

describe('AppShell', () => {
  let component: AppShell;
  let fixture: ComponentFixture<AppShell>;
  let mockOffcanvas: jasmine.SpyObj<NgbOffcanvas>;
  let mockSidebarControl: jasmine.SpyObj<SidebarControl>;
  let toggleSubject: Subject<void>;

  beforeEach(async () => {
    toggleSubject = new Subject<void>();
    mockOffcanvas = jasmine.createSpyObj('NgbOffcanvas', ['open']);
    mockSidebarControl = jasmine.createSpyObj('SidebarControl', ['toggle'], {
      toggle$: toggleSubject.asObservable()
    });

    const mockThemeService = jasmine.createSpyObj('ThemeService', ['toggleMode', 'getThemeIcon', 'getThemeLabel'], {
      isDark: signal(false)
    });

    const currentUserSignal: WritableSignal<any> = signal<any>(null);
    const mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser: currentUserSignal
    });
    mockAuthService.logout.and.returnValue(of(null));

    const mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getSiteName'], {
      siteConfig: signal({ uiFeaturesWithDefaults: {} })
    });

    const mockDemoModeService = jasmine.createSpyObj('DemoModeService', [], {
      demoMode: signal({ isActive: false })
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
      imports: [AppShell],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: NgbOffcanvas, useValue: mockOffcanvas },
        { provide: SidebarControl, useValue: mockSidebarControl },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: SiteConfigService, useValue: mockSiteConfigService },
        { provide: DemoModeService, useValue: mockDemoModeService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: CommunicationWebSocketService, useValue: mockWsService },
        { provide: MessageThreadService, useValue: mockMessageThreadService },
        { provide: AsyncTaskMonitorService, useValue: mockAsyncTaskMonitor }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppShell);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sidebarCollapsed starts as false', () => {
    expect(component.sidebarCollapsed()).toBeFalse();
  });

  it('updateSidebarState() updates sidebarCollapsed signal', () => {
    component.updateSidebarState(true);
    expect(component.sidebarCollapsed()).toBeTrue();
    component.updateSidebarState(false);
    expect(component.sidebarCollapsed()).toBeFalse();
  });
});
