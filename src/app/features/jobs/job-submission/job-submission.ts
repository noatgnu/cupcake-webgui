import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import {
  InstrumentJobService,
  JobType,
  Status,
  SampleType,
  InstrumentJob,
  InstrumentJobCreateRequest
} from '@noatgnu/cupcake-macaron';
import { ProjectService, Project, ProjectCreateRequest } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { JobSubmissionStateService } from './services/job-submission-state';
import { StepOneJobProjectComponent } from './steps/step-one-job-project/step-one-job-project';
import { StepTwoLabGroupStaffComponent } from './steps/step-two-lab-group-staff/step-two-lab-group-staff';
import { StepThreeSamplesComponent } from './steps/step-three-samples/step-three-samples';
import { StepFourTemplateComponent } from './steps/step-four-template/step-four-template';
import { StepFiveReviewSubmitComponent } from './steps/step-five-review-submit/step-five-review-submit';
import { StepSixStaffReviewComponent } from './steps/step-six-staff-review/step-six-staff-review';
import { MetadataTableEditor } from '../../../features/metadata/metadata-table-editor/metadata-table-editor';

@Component({
  selector: 'app-job-submission',
  imports: [
    CommonModule,
    FormsModule,
    NgbPaginationModule,
    StepOneJobProjectComponent,
    StepTwoLabGroupStaffComponent,
    StepThreeSamplesComponent,
    StepFourTemplateComponent,
    StepFiveReviewSubmitComponent,
    StepSixStaffReviewComponent,
    MetadataTableEditor
  ],
  providers: [JobSubmissionStateService],
  templateUrl: './job-submission.html',
  styleUrl: './job-submission.scss'
})
export class JobSubmission implements OnInit {
  private instrumentJobService = inject(InstrumentJobService);
  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  state = inject(JobSubmissionStateService);

  currentStep = signal(1);
  totalSteps = 6;

  private originalJobData: any = {};
  private stepDirtyFlags = new Map<number, boolean>();

  JobType = JobType;
  Status = Status;
  SampleType = SampleType;
  Math = Math;

  canGoNext = computed(() => {
    switch (this.currentStep()) {
      case 1:
        const hasJobTitle = this.state.jobTitle().trim().length > 0;
        const hasProject = this.state.selectedProjectId() !== null ||
                          (this.state.projectTitle().trim().length > 0 && this.state.projectDescription().trim().length > 0);
        return hasJobTitle && hasProject && this.state.jobId() !== null;
      case 2:
        return this.state.selectedLabGroupId() !== null;
      case 3:
        return this.state.sampleNumber() > 0;
      case 4:
        return this.state.selectedTemplateId() !== null;
      case 5:
        return this.state.metadataTableCreated();
      case 6:
        return true;
      default:
        return false;
    }
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const stepParam = params['step'];
      const targetStep = stepParam ? parseInt(stepParam, 10) : 1;

      const jobIdParam = params['jobId'];
      if (jobIdParam) {
        const id = parseInt(jobIdParam, 10);
        if (!isNaN(id)) {
          this.state.jobId.set(id);
          this.loadExistingJob(id, targetStep);
        }
      }

      const projectIdParam = params['projectId'];
      if (projectIdParam && !jobIdParam) {
        const projectId = parseInt(projectIdParam, 10);
        if (!isNaN(projectId)) {
          this.loadProjectById(projectId);
        }
      }
    });
  }

  loadProjectById(projectId: number): void {
    this.projectService.getProject(projectId).subscribe({
      next: (project) => {
        this.state.selectProject(project);
      },
      error: (err) => {
        console.error('Error loading project:', err);
        this.toastService.error('Failed to load project');
      }
    });
  }

  storeOriginalJobData(job: InstrumentJob): void {
    this.originalJobData = {
      jobName: job.jobName || '',
      project: job.project || null,
      labGroup: job.labGroup || null,
      staff: [...(job.staff || [])],
      funder: job.funder || '',
      costCenter: job.costCenter || '',
      sampleNumber: job.sampleNumber || 1,
      metadataTableTemplate: job.metadataTableTemplate || null
    };
    this.stepDirtyFlags.clear();
  }

  isStepDirty(step: number): boolean {
    switch (step) {
      case 1:
        return this.state.jobTitle() !== this.originalJobData.jobName ||
               this.state.selectedProjectId() !== this.originalJobData.project;
      case 2:
        return this.state.selectedLabGroupId() !== this.originalJobData.labGroup ||
               JSON.stringify(this.state.selectedStaffIds()) !== JSON.stringify(this.originalJobData.staff) ||
               this.state.funder() !== this.originalJobData.funder ||
               this.state.costCenter() !== this.originalJobData.costCenter;
      case 3:
        return this.state.sampleNumber() !== this.originalJobData.sampleNumber;
      case 4:
        return this.state.selectedTemplateId() !== this.originalJobData.metadataTableTemplate;
      default:
        return false;
    }
  }

  loadExistingJob(id: number, targetStep: number = 1): void {
    this.state.loading.set(true);
    this.instrumentJobService.getInstrumentJob(id).subscribe({
      next: (job) => {
        this.state.existingJob.set(job);
        this.state.jobTitle.set(job.jobName || '');
        this.state.selectedProjectId.set(job.project || null);
        this.state.projectTitle.set(job.projectName || '');
        this.state.funder.set(job.funder || '');
        this.state.funderSearchTerm.set(job.funder || '');
        this.state.costCenter.set(job.costCenter || '');
        this.state.costCenterSearchTerm.set(job.costCenter || '');
        this.state.selectedLabGroupId.set(job.labGroup || null);
        this.state.selectedStaffIds.set(job.staff || []);
        this.state.sampleNumber.set(job.sampleNumber || 1);

        if (job.metadataTable) {
          this.state.metadataTableId.set(job.metadataTable);
          this.state.metadataTableCreated.set(true);
        }

        if (job.metadataTableTemplate) {
          this.state.selectedTemplateId.set(job.metadataTableTemplate);
        }

        if (job.project) {
          this.loadProjectById(job.project);
        }

        if (job.labGroup) {
          this.state.labGroupSearchTerm.set(job.labGroupName || '');
          this.state.loadLabGroupMembers(job.labGroup);
          this.state.loadLabGroupTemplates(job.labGroup);
        }

        this.storeOriginalJobData(job);

        if (targetStep >= 1 && targetStep <= this.totalSteps) {
          this.currentStep.set(targetStep);
        } else {
          this.currentStep.set(1);
        }

        this.state.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading job:', err);
        this.toastService.error('Failed to load draft job');
        this.state.loading.set(false);
        this.router.navigate(['/jobs/submit']);
      }
    });
  }

  createDraftJob(): void {
    this.state.submitting.set(true);

    const projectId = this.state.selectedProjectId();

    if (projectId) {
      this.createJobWithProject(projectId);
    } else {
      const projectData: ProjectCreateRequest = {
        projectName: this.state.projectTitle(),
        projectDescription: this.state.projectDescription() || undefined
      };

      this.projectService.createProject(projectData).subscribe({
        next: (project) => {
          this.state.selectProject(project);
          this.toastService.success('Project created');
          this.createJobWithProject(project.id);
        },
        error: (err) => {
          console.error('Error creating project:', err);
          this.toastService.error('Failed to create project');
          this.state.submitting.set(false);
        }
      });
    }
  }

  createJobWithProject(projectId: number): void {
    const jobData: InstrumentJobCreateRequest = {
      jobType: JobType.ANALYSIS,
      jobName: this.state.jobTitle(),
      project: projectId
    };

    this.instrumentJobService.createInstrumentJob(jobData).subscribe({
      next: (job) => {
        this.state.jobId.set(job.id);
        this.state.existingJob.set(job);
        this.toastService.success('Draft job created');
        const nextStep = this.currentStep() + 1;
        this.currentStep.set(nextStep);
        this.state.submitting.set(false);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { jobId: job.id, step: nextStep },
          queryParamsHandling: 'merge'
        });
      },
      error: (err) => {
        console.error('Error creating draft job:', err);
        this.toastService.error('Failed to create draft job');
        this.state.submitting.set(false);
      }
    });
  }

  saveAndContinue(step: number): void {
    const jobIdValue = this.state.jobId();
    if (!jobIdValue) {
      this.toastService.error('No draft job found');
      return;
    }

    if (!this.isStepDirty(step)) {
      this.continueToNextStep(step);
      return;
    }

    this.state.submitting.set(true);
    const updateData: any = {};

    switch (step) {
      case 1:
        updateData.jobName = this.state.jobTitle().trim().length > 0 ? this.state.jobTitle() : undefined;
        if (this.state.selectedProjectId()) {
          updateData.project = this.state.selectedProjectId();
        } else if (this.state.projectTitle().trim().length > 0) {
          const projectData = {
            projectName: this.state.projectTitle(),
            projectDescription: this.state.projectDescription() || undefined
          };
          this.projectService.createProject(projectData).subscribe({
            next: (project) => {
              this.state.selectedProjectId.set(project.id);
              this.toastService.success('Project created');
              updateData.project = project.id;
              this.updateJob(jobIdValue, updateData, step);
            },
            error: (err) => {
              console.error('Error creating project:', err);
              this.toastService.error('Failed to create project');
              this.state.submitting.set(false);
            }
          });
          return;
        }
        break;
      case 2:
        updateData.labGroup = this.state.selectedLabGroupId() || undefined;
        updateData.staff = this.state.selectedStaffIds().length > 0 ? this.state.selectedStaffIds() : undefined;
        updateData.funder = this.state.funder().trim().length > 0 ? this.state.funder() : undefined;
        updateData.costCenter = this.state.costCenter().trim().length > 0 ? this.state.costCenter() : undefined;
        break;
      case 3:
        updateData.sampleNumber = this.state.sampleNumber();
        break;
      case 4:
        updateData.metadataTableTemplate = this.state.selectedTemplateId() || undefined;
        break;
      case 5:
        break;
    }

    this.updateJob(jobIdValue, updateData, step);
  }

  updateJob(jobId: number, updateData: any, step: number): void {
    if (Object.keys(updateData).length > 0) {
      this.instrumentJobService.patchInstrumentJob(jobId, updateData).subscribe({
        next: (job) => {
          this.state.existingJob.set(job);
          this.storeOriginalJobData(job);
          this.toastService.success('Changes saved');
          this.continueToNextStep(step);
          this.state.submitting.set(false);
        },
        error: (err) => {
          console.error('Error saving draft:', err);
          this.toastService.error('Failed to save draft');
          this.state.submitting.set(false);
        }
      });
    } else {
      this.continueToNextStep(step);
      this.state.submitting.set(false);
    }
  }

  continueToNextStep(currentStepNum: number): void {
    if (this.currentStep() < this.totalSteps) {
      const nextStep = this.currentStep() + 1;
      this.currentStep.set(nextStep);
      this.updateStepQueryParam(nextStep);
    }
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      const prevStep = this.currentStep() - 1;
      this.currentStep.set(prevStep);
      this.updateStepQueryParam(prevStep);
    }
  }

  updateStepQueryParam(step: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step },
      queryParamsHandling: 'merge'
    });
  }

  createMetadataTable(): void {
    const jobIdValue = this.state.jobId();
    const templateId = this.state.selectedTemplateId();

    if (!jobIdValue || !templateId) {
      this.toastService.error('Please complete all required fields');
      return;
    }

    this.state.submitting.set(true);

    this.instrumentJobService.createMetadataFromTemplate(jobIdValue, {
      templateId: templateId,
      sampleCount: this.state.sampleNumber()
    }).subscribe({
      next: (response) => {
        this.state.metadataTableId.set(response.metadataTable.id);
        this.state.metadataTableCreated.set(true);
        this.toastService.success('Metadata table created successfully');
        this.state.submitting.set(false);
      },
      error: (err) => {
        console.error('Error creating metadata table:', err);
        this.toastService.error('Failed to create metadata table');
        this.state.submitting.set(false);
      }
    });
  }

  submitJob(): void {
    const jobIdValue = this.state.jobId();

    if (!jobIdValue) {
      this.toastService.error('No job found');
      return;
    }

    if (!this.state.metadataTableCreated()) {
      this.toastService.error('Please create metadata table first');
      return;
    }

    this.state.submitting.set(true);

    this.instrumentJobService.submitJob(jobIdValue).subscribe({
      next: (response) => {
        this.toastService.success('Job submitted successfully');
        this.router.navigate(['/jobs', jobIdValue]);
      },
      error: (err) => {
        console.error('Error submitting job:', err);
        this.toastService.error('Failed to submit job');
        this.state.submitting.set(false);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/jobs']);
  }
}
