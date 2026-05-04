import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, SiteConfigService, ThemeService, ToastService, AuthService, WebSocketService, AsyncTaskMonitorService } from '@noatgnu/cupcake-core';
import { CommunicationWebSocketService } from '@noatgnu/cupcake-mint-chocolate';
import { App } from './app';

describe('App', () => {
  let mockSiteConfigService: jasmine.SpyObj<SiteConfigService>;
  let mockThemeService: jasmine.SpyObj<ThemeService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockCoreWsService: jasmine.SpyObj<WebSocketService>;
  let mockWsService: jasmine.SpyObj<CommunicationWebSocketService>;
  let mockAsyncTaskService: jasmine.SpyObj<AsyncTaskMonitorService>;

  beforeEach(async () => {
    mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getSiteName'], {
      siteConfig: signal({ primaryColor: '#1976d2' })
    });
    mockSiteConfigService.getSiteName.and.returnValue('cupcake');

    mockThemeService = jasmine.createSpyObj('ThemeService', ['toggleTheme', 'getThemeIcon', 'getThemeLabel'], {
      isDark: signal(false)
    });

    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);

    mockAuthService = jasmine.createSpyObj('AuthService', ['logout', 'getAccessToken'], {
      currentUser: signal(null)
    });
    mockAuthService.getAccessToken.and.returnValue(null);

    mockCoreWsService = jasmine.createSpyObj('WebSocketService', ['connect', 'disconnect']);
    mockWsService = jasmine.createSpyObj('CommunicationWebSocketService', ['connect', 'disconnect'], {
      newNotifications$: of()
    });
    mockAsyncTaskService = jasmine.createSpyObj('AsyncTaskMonitorService', ['startRealtimeUpdates', 'stopRealtimeUpdates', 'cancelTask'], {
      tasks: signal([]),
      activeTasks: signal([])
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: SiteConfigService, useValue: mockSiteConfigService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: WebSocketService, useValue: mockCoreWsService },
        { provide: CommunicationWebSocketService, useValue: mockWsService },
        { provide: AsyncTaskMonitorService, useValue: mockAsyncTaskService }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should initialize title signal to cupcake', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect((app as any).title()).toBe('cupcake');
  });
});
