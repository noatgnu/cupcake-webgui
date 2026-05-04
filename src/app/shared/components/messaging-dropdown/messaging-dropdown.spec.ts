import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { MessageThreadService } from '@noatgnu/cupcake-mint-chocolate';
import { DropdownCoordinator } from '../../services/dropdown-coordinator';
import { MessagingDropdown } from './messaging-dropdown';

describe('MessagingDropdown', () => {
  let component: MessagingDropdown;
  let fixture: ComponentFixture<MessagingDropdown>;
  let mockThreadService: jasmine.SpyObj<MessageThreadService>;

  beforeEach(async () => {
    mockThreadService = jasmine.createSpyObj('MessageThreadService', ['getActiveThreads', 'getMessageThreads']);
    mockThreadService.getActiveThreads.and.returnValue(of({ count: 0, results: [] }));
    const mockDropdownCoordinator = jasmine.createSpyObj('DropdownCoordinator', [
      'openDropdown', 'closeDropdown', 'getActiveDropdown', 'isDropdownOpen'
    ]);
    mockDropdownCoordinator.getActiveDropdown.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [MessagingDropdown],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: MessageThreadService, useValue: mockThreadService },
        { provide: DropdownCoordinator, useValue: mockDropdownCoordinator }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MessagingDropdown);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('threads starts empty', () => {
    expect(component.threads()).toEqual([]);
  });

  it('isOpen starts as false', () => {
    expect(component.isOpen()).toBeFalse();
  });

  it('loadThreads calls MessageThreadService.getActiveThreads', () => {
    expect(mockThreadService.getActiveThreads).toHaveBeenCalled();
  });
});
