import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AsyncTaskMonitorService, TaskStatus, ToastService } from '@noatgnu/cupcake-core';
import { ProtocolModel, ProtocolService } from '@noatgnu/cupcake-red-velvet';
import {
  ProtocolsIOAccountService,
  ProtocolsIOExportResult,
  ProtocolsIOProtocolEntry,
  ProtocolsIOProtocolService
} from '@noatgnu/cupcake-protocols-io';

import { ProtocolsIoBrowser } from '../protocols-io-browser/protocols-io-browser';

export interface ExportTarget {
  reference: string;
  title: string;
  workspace: string | null;
}

@Component({
  selector: 'app-protocols-io-export',
  imports: [FormsModule, RouterLink, ProtocolsIoBrowser],
  templateUrl: './protocols-io-export.html',
  styleUrl: './protocols-io-export.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolsIoExport implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private protocolService = inject(ProtocolService);
  private accountService = inject(ProtocolsIOAccountService);
  private protocolsIOProtocolService = inject(ProtocolsIOProtocolService);
  private taskMonitor = inject(AsyncTaskMonitorService);
  private toastService = inject(ToastService);

  protocolId = signal<number | null>(null);
  protocol = signal<ProtocolModel | null>(null);
  connected = signal<boolean | null>(null);
  target = signal<ExportTarget | null>(null);
  pastedAddress = signal('');
  scalingFactor = signal(1);
  queuing = signal(false);
  taskId = signal<string | null>(null);

  task = computed(() => {
    const id = this.taskId();
    return id ? this.taskMonitor.tasks().find(task => task.id === id) ?? null : null;
  });
  finished = computed(() => {
    const status = this.task()?.status;
    return status === TaskStatus.SUCCESS || status === TaskStatus.FAILURE || status === TaskStatus.CANCELLED;
  });
  succeeded = computed(() => this.task()?.status === TaskStatus.SUCCESS);
  result = computed(() => this.succeeded() ? (this.task()?.result as unknown as ProtocolsIOExportResult) : null);
  progress = computed(() => Math.round(this.task()?.progressPercentage ?? 0));

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/protocols']);
      return;
    }
    this.protocolId.set(id);
    this.protocolService.getProtocol(id).subscribe({
      next: protocol => this.protocol.set(protocol),
      error: () => {
        this.toastService.error('Failed to load the protocol');
        this.router.navigate(['/protocols']);
      }
    });
    this.accountService.getStatus().subscribe({
      next: status => this.connected.set(status.connected),
      error: () => this.toastService.error('Failed to load the protocols.io account')
    });
  }

  chooseProtocol(entry: ProtocolsIOProtocolEntry): void {
    this.target.set({ reference: entry.uri, title: entry.title, workspace: entry.workspace.title || null });
  }

  usePastedAddress(): void {
    const address = this.pastedAddress().trim();
    if (!address) {
      return;
    }
    this.target.set({ reference: address, title: address, workspace: null });
  }

  chooseAnother(): void {
    this.target.set(null);
  }

  startExport(): void {
    const id = this.protocolId();
    const target = this.target();
    if (!id || !target) {
      return;
    }
    const scalingFactor = Number(this.scalingFactor());
    if (!Number.isFinite(scalingFactor) || scalingFactor <= 0) {
      this.toastService.warning('The scaling factor must be a positive number');
      return;
    }
    this.queuing.set(true);
    this.protocolsIOProtocolService.exportProtocol(id, { target: target.reference, scalingFactor }).subscribe({
      next: queued => {
        this.queuing.set(false);
        this.taskId.set(queued.taskId);
        this.taskMonitor.pollUntilComplete(queued.taskId);
      },
      error: (error: HttpErrorResponse) => {
        this.queuing.set(false);
        this.toastService.error(error.error?.error || 'Failed to start the export');
      }
    });
  }

  exportAgain(): void {
    this.taskId.set(null);
  }
}
