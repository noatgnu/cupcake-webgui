import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JobSubmissionStateService } from '../../services/job-submission-state';

@Component({
  selector: 'app-step-three-samples',
  imports: [CommonModule],
  templateUrl: './step-three-samples.html',
  styleUrl: './step-three-samples.scss'
})
export class StepThreeSamplesComponent {
  state = inject(JobSubmissionStateService);

  previous = output<void>();
  saveAndContinue = output<void>();

  canGoNext(): boolean {
    return this.state.sampleNumber() > 0;
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onSaveAndContinue(): void {
    this.saveAndContinue.emit();
  }
}
