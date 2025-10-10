import { Component, Input, inject, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Project } from '@noatgnu/cupcake-red-velvet';
import { InstrumentJobService, InstrumentJob } from '@noatgnu/cupcake-macaron';
import { SessionService, Session } from '@noatgnu/cupcake-red-velvet';

@Component({
  selector: 'app-project-detail',
  imports: [CommonModule],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss'
})
export class ProjectDetail implements OnInit, OnChanges {
  @Input() project!: Project;

  private instrumentJobService = inject(InstrumentJobService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  jobs = signal<InstrumentJob[]>([]);
  sessions = signal<Session[]>([]);
  loadingJobs = signal(false);
  loadingSessions = signal(false);

  ngOnInit(): void {
    this.loadProjectData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project'] && !changes['project'].firstChange) {
      this.loadProjectData();
    }
  }

  loadProjectData(): void {
    if (!this.project?.id) return;
    this.loadJobs();
    this.loadSessions();
  }

  loadJobs(): void {
    this.loadingJobs.set(true);
    this.instrumentJobService.getInstrumentJobs({ project: this.project.id, limit: 10 }).subscribe({
      next: (response) => {
        this.jobs.set(response.results);
        this.loadingJobs.set(false);
      },
      error: (err) => {
        console.error('Error loading jobs:', err);
        this.loadingJobs.set(false);
      }
    });
  }

  loadSessions(): void {
    this.loadingSessions.set(true);
    this.sessionService.getSessions({ projects: this.project.id, limit: 10 }).subscribe({
      next: (response) => {
        this.sessions.set(response.results);
        this.loadingSessions.set(false);
      },
      error: (err) => {
        console.error('Error loading sessions:', err);
        this.loadingSessions.set(false);
      }
    });
  }

  viewJob(job: InstrumentJob): void {
    this.router.navigate(['/jobs', job.id]);
  }

  viewSession(session: Session): void {
    this.router.navigate(['/sessions', session.id]);
  }

  createJob(): void {
    this.router.navigate(['/jobs/submit'], {
      queryParams: { projectId: this.project.id }
    });
  }
}
