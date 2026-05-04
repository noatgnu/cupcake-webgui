import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { NotificationService, CommunicationWebSocketService } from '@noatgnu/cupcake-mint-chocolate';
import { DropdownCoordinator } from '../../services/dropdown-coordinator';
import { NotificationDropdown } from './notification-dropdown';

describe('NotificationDropdown', () => {
  let component: NotificationDropdown;
  let fixture: ComponentFixture<NotificationDropdown>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    mockNotificationService = jasmine.createSpyObj('NotificationService', [
      'getUnreadNotifications', 'markNotificationRead'
    ]);
    mockNotificationService.getUnreadNotifications.and.returnValue(of({ count: 0, results: [] }));

    const mockWsService = jasmine.createSpyObj('CommunicationWebSocketService', ['connect', 'disconnect'], {
      newNotifications$: new Subject<any>().asObservable()
    });

    const mockDropdownCoordinator = jasmine.createSpyObj('DropdownCoordinator', [
      'openDropdown', 'closeDropdown', 'getActiveDropdown', 'isDropdownOpen'
    ]);
    mockDropdownCoordinator.getActiveDropdown.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [NotificationDropdown],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: CommunicationWebSocketService, useValue: mockWsService },
        { provide: DropdownCoordinator, useValue: mockDropdownCoordinator }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationDropdown);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('notifications starts empty', () => {
    expect(component.notifications()).toEqual([]);
  });

  it('isOpen starts as false', () => {
    expect(component.isOpen()).toBeFalse();
  });

  it('loadNotifications calls NotificationService.getUnreadNotifications', () => {
    expect(mockNotificationService.getUnreadNotifications).toHaveBeenCalled();
  });
});
