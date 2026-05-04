import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { NotificationService, NotificationPriority, CommunicationWebSocketService } from '@noatgnu/cupcake-mint-chocolate';
import { NotificationsView } from './notifications-view';

describe('NotificationsView', () => {
  let component: NotificationsView;
  let fixture: ComponentFixture<NotificationsView>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockWsService: jasmine.SpyObj<CommunicationWebSocketService>;
  let newNotificationsSubject: Subject<any>;

  beforeEach(async () => {
    newNotificationsSubject = new Subject<any>();

    mockNotificationService = jasmine.createSpyObj('NotificationService', [
      'getNotifications',
      'markNotificationRead',
      'markAllNotificationsRead'
    ]);
    mockNotificationService.getNotifications.and.returnValue(of({ count: 0, results: [] }));
    mockNotificationService.markAllNotificationsRead.and.returnValue(of({ success: true, message: 'ok' }));

    mockWsService = jasmine.createSpyObj('CommunicationWebSocketService', ['connect', 'disconnect'], {
      newNotifications$: newNotificationsSubject.asObservable()
    });

    await TestBed.configureTestingModule({
      imports: [NotificationsView],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: CommunicationWebSocketService, useValue: mockWsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadNotifications() calls NotificationService.getNotifications()', () => {
    expect(mockNotificationService.getNotifications).toHaveBeenCalled();
  });

  it('markAllAsRead() calls NotificationService.markAllNotificationsRead()', () => {
    component.markAllAsRead();
    expect(mockNotificationService.markAllNotificationsRead).toHaveBeenCalled();
  });

  it('clearFilters() resets filter properties and page', () => {
    component.filterType = 'info';
    component.filterPriority = 'high';
    component.filterIsRead = 'true';
    component.page.set(3);
    component.clearFilters();
    expect(component.filterType).toBe('');
    expect(component.filterPriority).toBe('');
    expect(component.filterIsRead).toBe('');
    expect(component.page()).toBe(1);
  });

  it('getPriorityClass() returns correct CSS class', () => {
    expect(component.getPriorityClass(NotificationPriority.HIGH)).toBe('text-warning');
    expect(component.getPriorityClass(NotificationPriority.URGENT)).toBe('text-danger');
    expect(component.getPriorityClass(NotificationPriority.LOW)).toBe('text-secondary');
  });

  it('getPriorityBadgeClass() returns correct badge class', () => {
    expect(component.getPriorityBadgeClass(NotificationPriority.NORMAL)).toBe('bg-primary');
    expect(component.getPriorityBadgeClass(NotificationPriority.URGENT)).toBe('bg-danger');
  });
});
