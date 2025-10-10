import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InstrumentJobService, Status, JobType, InstrumentJob } from '@noatgnu/cupcake-macaron';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-job-list',
  imports: [CommonModule, FormsModule, NgbPaginationModule],
  templateUrl: './job-list.html',
  styleUrl: './job-list.scss'
})
export class JobList implements OnInit {
  private instrumentJobService = inject(InstrumentJobService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private router = inject(Router);

  jobs = signal<InstrumentJob[]>([]);
  selectedJob = signal<InstrumentJob | null>(null);
  loading = signal(false);
  searchTerm = '';
  filterStatus = signal<Status | ''>('');
  filterJobType = signal<JobType | ''>('');

  currentPage = signal(1);
  pageSize = 10;
  totalCount = signal(0);
  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize));
  Math = Math;

  currentUser = toSignal(this.authService.currentUser$);

  canEdit = computed(() => {
    const job = this.selectedJob();
    const user = this.currentUser();
    if (!job || !user) return false;
    return job.user === user.id && job.status === Status.DRAFT;
  });

  isDraft = computed(() => {
    const job = this.selectedJob();
    return job?.status === Status.DRAFT;
  });

  Status = Status;
  JobType = JobType;

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading.set(true);
    const offset = (this.currentPage() - 1) * this.pageSize;
    const params: any = {
      limit: this.pageSize,
      offset,
      ordering: '-createdAt'
    };

    if (this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }

    if (this.filterStatus()) {
      params.status = this.filterStatus();
    }

    if (this.filterJobType()) {
      params.jobType = this.filterJobType();
    }

    this.instrumentJobService.getInstrumentJobs(params).subscribe({
      next: (response) => {
        this.totalCount.set(response.count);
        this.jobs.set(response.results);
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load jobs');
        console.error('Error loading jobs:', err);
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.currentPage.set(1);
    this.loadJobs();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadJobs();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadJobs();
    }
  }

  createJob(): void {
    this.router.navigate(['/jobs/submit']);
  }

  selectJob(job: InstrumentJob): void {
    this.selectedJob.set(job);
  }

  deselectJob(): void {
    this.selectedJob.set(null);
  }

  viewJob(jobId: number): void {
    this.router.navigate(['/jobs', jobId]);
  }

  editJob(): void {
    const job = this.selectedJob();
    if (!job) return;
    this.router.navigate(['/jobs/submit'], {
      queryParams: { jobId: job.id }
    });
  }
}
