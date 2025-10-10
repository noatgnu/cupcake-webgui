import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JobSubmissionStateService } from '../../services/job-submission-state';

@Component({
  selector: 'app-step-four-template',
  imports: [CommonModule],
  templateUrl: './step-four-template.html',
  styleUrl: './step-four-template.scss'
})
export class StepFourTemplateComponent {
  state = inject(JobSubmissionStateService);

  previous = output<void>();
  saveAndContinue = output<void>();

  canGoNext(): boolean {
    return this.state.selectedTemplateId() !== null;
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onSaveAndContinue(): void {
    this.saveAndContinue.emit();
  }
}
