import { Component, inject, output, ChangeDetectionStrategy } from '@angular/core';

import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

import { JobSubmissionStateService } from '../../services/job-submission-state';

@Component({
  selector: 'app-step-four-template',
  imports: [NgbPagination],
  templateUrl: './step-four-template.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
