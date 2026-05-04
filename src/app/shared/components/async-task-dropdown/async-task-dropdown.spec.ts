import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CUPCAKE_CORE_CONFIG, AsyncTaskMonitorService } from '@noatgnu/cupcake-core';
import { DropdownCoordinator } from '../../services/dropdown-coordinator';
import { AsyncTaskDropdown } from './async-task-dropdown';

describe('AsyncTaskDropdown', () => {
  let component: AsyncTaskDropdown;
  let fixture: ComponentFixture<AsyncTaskDropdown>;

  beforeEach(async () => {
    const mockTaskService = jasmine.createSpyObj('AsyncTaskMonitorService', ['loadAllTasks'], {
      tasks: signal([]),
      activeTasks: signal([])
    });
    const mockDropdownCoordinator = jasmine.createSpyObj('DropdownCoordinator', [
      'openDropdown', 'closeDropdown', 'getActiveDropdown', 'isDropdownOpen'
    ]);
    mockDropdownCoordinator.getActiveDropdown.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [AsyncTaskDropdown],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        provideRouter([]),
        { provide: AsyncTaskMonitorService, useValue: mockTaskService },
        { provide: DropdownCoordinator, useValue: mockDropdownCoordinator }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AsyncTaskDropdown);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isOpen starts as false', () => {
    expect(component.isOpen()).toBeFalse();
  });

  it('recentTasks starts empty', () => {
    expect(component.recentTasks()).toEqual([]);
  });

  it('activeCount starts at 0', () => {
    expect(component.activeCount()).toBe(0);
  });
});
