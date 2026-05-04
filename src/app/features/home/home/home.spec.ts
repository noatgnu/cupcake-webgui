import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, SiteConfigService } from '@noatgnu/cupcake-core';
import { SessionService, TimeKeeperService } from '@noatgnu/cupcake-red-velvet';
import { MessageThreadService, NotificationService } from '@noatgnu/cupcake-mint-chocolate';
import { AsyncTaskUIService } from '@noatgnu/cupcake-vanilla';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let mockSessionService: jasmine.SpyObj<SessionService>;
  let mockTimeKeeperService: jasmine.SpyObj<TimeKeeperService>;
  let mockMessageThreadService: jasmine.SpyObj<MessageThreadService>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockSiteConfigService: jasmine.SpyObj<SiteConfigService>;

  beforeEach(async () => {
    mockSessionService = jasmine.createSpyObj('SessionService', ['getSessions']);
    mockSessionService.getSessions.and.returnValue(of({ count: 0, results: [] }));

    mockTimeKeeperService = jasmine.createSpyObj('TimeKeeperService', ['getTimeKeepers']);
    mockTimeKeeperService.getTimeKeepers.and.returnValue(of({ count: 0, results: [] }));

    mockMessageThreadService = jasmine.createSpyObj('MessageThreadService', ['getMessageThreads', 'getActiveThreads']);
    mockMessageThreadService.getMessageThreads.and.returnValue(of({ count: 0, results: [] }));
    mockMessageThreadService.getActiveThreads.and.returnValue(of({ count: 0, results: [] }));

    mockNotificationService = jasmine.createSpyObj('NotificationService', ['getNotifications', 'getUnreadNotifications', 'markNotificationRead']);
    mockNotificationService.getNotifications.and.returnValue(of({ count: 0, results: [] }));
    mockNotificationService.getUnreadNotifications.and.returnValue(of({ count: 0, results: [] }));

    mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getSiteName'], {
      siteConfig: signal({ uiFeaturesWithDefaults: {} })
    });

    const mockAsyncTaskService = jasmine.createSpyObj('AsyncTaskUIService', [
      'cancelTask', 'downloadTaskResult', 'canCancelTask', 'canDownloadResult', 'getTaskDisplayName', 'formatDuration'
    ], { tasks: signal([]) });
    mockAsyncTaskService.canCancelTask.and.returnValue(false);
    mockAsyncTaskService.canDownloadResult.and.returnValue(false);
    mockAsyncTaskService.getTaskDisplayName.and.returnValue('');
    mockAsyncTaskService.formatDuration.and.returnValue('');

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: SessionService, useValue: mockSessionService },
        { provide: TimeKeeperService, useValue: mockTimeKeeperService },
        { provide: MessageThreadService, useValue: mockMessageThreadService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: SiteConfigService, useValue: mockSiteConfigService },
        { provide: AsyncTaskUIService, useValue: mockAsyncTaskService },
        { provide: SidebarControl, useValue: jasmine.createSpyObj('SidebarControl', ['toggle']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call SessionService.getSessions() on init', () => {
    expect(mockSessionService.getSessions).toHaveBeenCalled();
  });

  it('should call TimeKeeperService.getTimeKeepers() on init', () => {
    expect(mockTimeKeeperService.getTimeKeepers).toHaveBeenCalled();
  });

  it('activeSection defaults to dashboard', () => {
    expect(component.activeSection).toBe('dashboard');
  });

  it('recentSessions starts empty', () => {
    expect(component.recentSessions()).toEqual([]);
  });
});
