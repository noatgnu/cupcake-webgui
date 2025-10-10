import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JobSubmissionStateService } from '../../services/job-submission-state';
import { Project } from '@noatgnu/cupcake-red-velvet';

@Component({
  selector: 'app-step-one-job-project',
  imports: [CommonModule],
  templateUrl: './step-one-job-project.html',
  styleUrl: './step-one-job-project.scss'
})
export class StepOneJobProjectComponent {
  state = inject(JobSubmissionStateService);

  createDraft = output<void>();
  saveAndContinue = output<void>();

  canCreateDraft(): boolean {
    return this.state.jobTitle().trim().length > 0 && this.state.projectTitle().trim().length > 0;
  }

  canGoNext(): boolean {
    return this.state.jobTitle().trim().length > 0 && this.state.projectTitle().trim().length > 0;
  }

  onProjectTitleInput(value: string): void {
    this.state.projectTitle.set(value);
    this.state.projectSearchSubject.next(value);
    this.state.showProjectSuggestions.set(true);
  }

  selectProject(project: Project): void {
    this.state.selectProject(project);
  }

  hideProjectSuggestions(): void {
    setTimeout(() => this.state.showProjectSuggestions.set(false), 200);
  }

  onCreateDraft(): void {
    this.createDraft.emit();
  }

  onSaveAndContinue(): void {
    this.saveAndContinue.emit();
  }
}
