import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AsyncTaskUIService } from '@noatgnu/cupcake-vanilla';
import { AsyncTaskStatus, TaskStatus, TASK_TYPE_LABELS, TASK_STATUS_COLORS } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-async-task-floating-panel',
  imports: [CommonModule],
  templateUrl: './async-task-floating-panel.html',
  styleUrl: './async-task-floating-panel.scss',
})
export class AsyncTaskFloatingPanel implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTasks = signal<AsyncTaskStatus[]>([]);
  isMinimized = signal(false);

  hasActiveTasks = computed(() => this.activeTasks().length > 0);
  taskCount = computed(() => this.activeTasks().length);

  readonly taskTypeLabels = TASK_TYPE_LABELS;
  readonly taskStatusColors = TASK_STATUS_COLORS;
  readonly TaskStatus = TaskStatus;

  constructor(
    private asyncTaskService: AsyncTaskUIService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.asyncTaskService.activeTasks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        const taskArray = Array.isArray(tasks) ? tasks : [];
        this.activeTasks.set(taskArray);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMinimize(): void {
    this.isMinimized.set(!this.isMinimized());
  }

  viewAllTasks(): void {
    this.router.navigate(['/home'], { fragment: 'tasks' });
  }

  getProgressPercentage(task: AsyncTaskStatus): number {
    return task.progressPercentage || 0;
  }

  getTaskDisplayName(task: AsyncTaskStatus): string {
    return this.asyncTaskService.getTaskDisplayName(task.taskType);
  }

  cancelTask(taskId: string, event: Event): void {
    event.stopPropagation();
    this.asyncTaskService.cancelTask(taskId).subscribe({
      next: () => {},
      error: (error) => {
        console.error('Error cancelling task:', error);
      }
    });
  }
}
