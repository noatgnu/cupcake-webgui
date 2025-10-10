import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { InstrumentJobService, InstrumentJob, Status } from '@noatgnu/cupcake-macaron';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MetadataTableEditor } from '../../metadata/metadata-table-editor/metadata-table-editor';
import { JobAnnotationsSection } from './job-annotations-section/job-annotations-section';

@Component({
  selector: 'app-job-detail',
  imports: [CommonModule, MetadataTableEditor, JobAnnotationsSection],
  templateUrl: './job-detail.html',
  styleUrl: './job-detail.scss'
})
export class JobDetail implements OnInit {
  private instrumentJobService = inject(InstrumentJobService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  job = signal<InstrumentJob | null>(null);
  loading = signal(false);

  currentUser = toSignal(this.authService.currentUser$);

  canEdit = computed(() => {
    const jobValue = this.job();
    const user = this.currentUser();
    if (!jobValue || !user) return false;
    return jobValue.user === user.id && jobValue.status === Status.DRAFT;
  });

  isDraft = computed(() => {
    const jobValue = this.job();
    return jobValue?.status === Status.DRAFT;
  });

  isAssignedStaff = computed(() => {
    const jobValue = this.job();
    const user = this.currentUser();
    if (!jobValue || !user || !jobValue.staff) return false;
    return jobValue.staff.includes(user.id!);
  });

  isJobOwner = computed(() => {
    const jobValue = this.job();
    const user = this.currentUser();
    if (!jobValue || !user) return false;
    return jobValue.user === user.id;
  });

  canEditMetadata = computed(() => {
    return this.isAssignedStaff();
  });

  hasMetadataTable = computed(() => {
    const jobValue = this.job();
    return jobValue?.metadataTable != null;
  });

  Status = Status;

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        const jobId = parseInt(id, 10);
        if (!isNaN(jobId)) {
          this.loadJob(jobId);
        }
      }
    });
  }

  loadJob(id: number): void {
    this.loading.set(true);
    this.instrumentJobService.getInstrumentJob(id).subscribe({
      next: (job) => {
        this.job.set(job);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading job:', err);
        this.toastService.error('Failed to load job');
        this.loading.set(false);
        this.router.navigate(['/jobs']);
      }
    });
  }

  editJob(): void {
    const jobValue = this.job();
    if (!jobValue) return;
    this.router.navigate(['/jobs/submit'], {
      queryParams: { jobId: jobValue.id }
    });
  }

  backToList(): void {
    this.router.navigate(['/jobs']);
  }
}
