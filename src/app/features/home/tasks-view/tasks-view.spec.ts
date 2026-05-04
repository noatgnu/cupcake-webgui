import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TaskStatus } from '@noatgnu/cupcake-core';
import { AsyncTaskUIService } from '@noatgnu/cupcake-vanilla';
import { TasksView } from './tasks-view';

describe('TasksView', () => {
  let component: TasksView;
  let fixture: ComponentFixture<TasksView>;
  let mockAsyncTaskService: jasmine.SpyObj<AsyncTaskUIService>;

  beforeEach(async () => {
    mockAsyncTaskService = jasmine.createSpyObj('AsyncTaskUIService', [
      'cancelTask',
      'downloadTaskResult',
      'canCancelTask',
      'canDownloadResult',
      'getTaskDisplayName',
      'formatDuration'
    ], {
      tasks: signal([])
    });
    mockAsyncTaskService.canCancelTask.and.returnValue(false);
    mockAsyncTaskService.canDownloadResult.and.returnValue(false);
    mockAsyncTaskService.getTaskDisplayName.and.returnValue('Test Task');
    mockAsyncTaskService.formatDuration.and.returnValue('0s');

    await TestBed.configureTestingModule({
      imports: [TasksView],
      providers: [
        { provide: AsyncTaskUIService, useValue: mockAsyncTaskService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TasksView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('selectedFilter starts as all', () => {
    expect(component.selectedFilter()).toBe('all');
  });

  it('setFilter() updates selectedFilter and resets page', () => {
    component.setFilter('active');
    expect(component.selectedFilter()).toBe('active');
    expect(component.currentPage()).toBe(1);
  });

  it('filteredTasks returns all tasks when filter is all', () => {
    const tasks = [
      { id: '1', status: TaskStatus.SUCCESS },
      { id: '2', status: TaskStatus.QUEUED }
    ] as any;
    component.allTasks.set(tasks);
    expect(component.filteredTasks().length).toBe(2);
  });

  it('filteredTasks filters by active status', () => {
    const tasks = [
      { id: '1', status: TaskStatus.SUCCESS },
      { id: '2', status: TaskStatus.QUEUED },
      { id: '3', status: TaskStatus.STARTED }
    ] as any;
    component.allTasks.set(tasks);
    component.setFilter('active');
    expect(component.filteredTasks().length).toBe(2);
  });

  it('filteredTasks filters by completed status', () => {
    const tasks = [
      { id: '1', status: TaskStatus.SUCCESS },
      { id: '2', status: TaskStatus.QUEUED }
    ] as any;
    component.allTasks.set(tasks);
    component.setFilter('completed');
    expect(component.filteredTasks().length).toBe(1);
  });

  it('onPageChange() updates currentPage', () => {
    component.onPageChange(3);
    expect(component.currentPage()).toBe(3);
  });
});
