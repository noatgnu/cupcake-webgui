import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AsyncTaskUIService } from '@noatgnu/cupcake-vanilla';
import {
  AsyncTaskStatus,
  TaskType,
  TaskStatus,
  TASK_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS
} from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-tasks-view',
  imports: [CommonModule, NgbPagination],
  templateUrl: './tasks-view.html',
  styleUrl: './tasks-view.scss',
})
export class TasksView implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  allTasks = signal<AsyncTaskStatus[]>([]);
  selectedFilter = signal<'all' | 'active' | 'completed' | 'failed'>('all');
  currentPage = signal(1);
  pageSize = 10;
  Math = Math;

  readonly taskTypeLabels = TASK_TYPE_LABELS;
  readonly taskStatusLabels = TASK_STATUS_LABELS;
  readonly taskStatusColors = TASK_STATUS_COLORS;
  readonly TaskStatus = TaskStatus;
  readonly TaskType = TaskType;

  filteredTasks = computed(() => {
    const tasks = this.allTasks();
    const filter = this.selectedFilter();

    if (!Array.isArray(tasks)) {
      return [];
    }

    switch (filter) {
      case 'active':
        return tasks.filter(task => task.status === TaskStatus.QUEUED || task.status === TaskStatus.STARTED);
      case 'completed':
        return tasks.filter(task => task.status === TaskStatus.SUCCESS);
      case 'failed':
        return tasks.filter(task => task.status === TaskStatus.FAILURE);
      default:
        return tasks;
    }
  });

  paginatedTasks = computed(() => {
    const tasks = this.filteredTasks();
    const page = this.currentPage();
    const start = (page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return tasks.slice(start, end);
  });

  totalTasks = computed(() => this.filteredTasks().length);
  totalPages = computed(() => Math.ceil(this.totalTasks() / this.pageSize));

  constructor(private asyncTaskService: AsyncTaskUIService) {}

  ngOnInit(): void {
    this.asyncTaskService.tasks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        const taskArray = Array.isArray(tasks) ? tasks : [];
        this.allTasks.set(taskArray);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setFilter(filter: 'all' | 'active' | 'completed' | 'failed'): void {
    this.selectedFilter.set(filter);
    this.currentPage.set(1);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  cancelTask(taskId: string): void {
    this.asyncTaskService.cancelTask(taskId).subscribe({
      next: () => {},
      error: (error) => {
        console.error('Error cancelling task:', error);
      }
    });
  }

  downloadResult(task: AsyncTaskStatus): void {
    this.asyncTaskService.downloadTaskResult(task.id);
  }

  canCancelTask(task: AsyncTaskStatus): boolean {
    return this.asyncTaskService.canCancelTask(task.status);
  }

  canDownloadResult(task: AsyncTaskStatus): boolean {
    return this.asyncTaskService.canDownloadResult(task);
  }

  getTaskDisplayName(task: AsyncTaskStatus): string {
    return this.asyncTaskService.getTaskDisplayName(task.taskType);
  }

  formatDuration(duration: number | null): string {
    return this.asyncTaskService.formatDuration(duration);
  }

  getStatusBadgeClass(status: TaskStatus): string {
    const colors = this.taskStatusColors[status] || 'secondary';
    return `bg-${colors}`;
  }
}
