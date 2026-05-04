import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ToastService, AuthService } from '@noatgnu/cupcake-core';
import { TimeKeeperService, SessionService, ProtocolStepService, TimeKeeperWebSocketService } from '@noatgnu/cupcake-red-velvet';
import { TimekeeperStandalone } from './timekeeper-standalone';

describe('TimekeeperStandalone', () => {
  let component: TimekeeperStandalone;
  let fixture: ComponentFixture<TimekeeperStandalone>;
  let mockTimeKeeperService: jasmine.SpyObj<TimeKeeperService>;

  beforeEach(async () => {
    mockTimeKeeperService = jasmine.createSpyObj('TimeKeeperService', [
      'getTimeKeepers', 'getTimeKeeper', 'createTimeKeeper', 'startTimer', 'stopTimer',
      'patchTimeKeeper', 'resetTimer', 'deleteTimeKeeper'
    ]);
    mockTimeKeeperService.getTimeKeepers.and.returnValue(of({ count: 0, results: [] }));

    const mockSessionService = jasmine.createSpyObj('SessionService', ['getSession']);
    const mockStepService = jasmine.createSpyObj('ProtocolStepService', ['getProtocolStep']);
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    const mockAuthService = jasmine.createSpyObj('AuthService', ['getAccessToken', 'logout'], {
      currentUser: signal(null)
    });
    mockAuthService.getAccessToken.and.returnValue(null);

    const mockWsService = jasmine.createSpyObj('TimeKeeperWebSocketService', ['connect', 'disconnect'], {
      timeKeeperStarted$: new Subject<any>().asObservable(),
      timeKeeperStopped$: new Subject<any>().asObservable(),
      timeKeeperUpdated$: new Subject<any>().asObservable()
    });

    await TestBed.configureTestingModule({
      imports: [TimekeeperStandalone],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: TimeKeeperService, useValue: mockTimeKeeperService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: ProtocolStepService, useValue: mockStepService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: TimeKeeperWebSocketService, useValue: mockWsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TimekeeperStandalone);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('timekeepers signal starts empty', () => {
    expect(component.timekeepers()).toEqual([]);
  });

  it('loading signal starts as false after init resolves', () => {
    expect(component.loading()).toBeFalse();
  });

  it('loadTimekeepers calls TimeKeeperService.getTimeKeepers', () => {
    expect(mockTimeKeeperService.getTimeKeepers).toHaveBeenCalled();
  });

  it('filterType defaults to all', () => {
    expect(component.filterType()).toBe('all');
  });

  it('setFilter updates filterType', () => {
    component.setFilter('standalone');
    expect(component.filterType()).toBe('standalone');
  });

  it('formatDuration returns N/A for undefined', () => {
    expect(component.formatDuration(undefined)).toBe('N/A');
  });

  it('formatDuration formats seconds correctly', () => {
    expect(component.formatDuration(65)).toBe('1m 5s');
  });

  it('cancelCreate resets form fields', () => {
    component.newTimerName = 'Test';
    component.cancelCreate();
    expect(component.newTimerName).toBe('');
    expect(component.showCreateForm()).toBeFalse();
  });
});
