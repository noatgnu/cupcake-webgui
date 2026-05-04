import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { AsyncTaskUIService } from '@noatgnu/cupcake-vanilla';
import { AsyncTaskStatus, TaskStatus, TASK_TYPE_LABELS, TASK_STATUS_COLORS } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-async-task-floating-panel',
  imports: [],
  templateUrl: './async-task-floating-panel.html',
  styleUrl: './async-task-floating-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AsyncTaskFloatingPanel implements OnInit, OnDestroy {
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
  ) {
    effect(() => {
      const tasks = this.asyncTaskService.activeTasks();
      this.activeTasks.set(Array.isArray(tasks) ? tasks : []);
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {}

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
      error: () => {
      }
    });
  }
}
