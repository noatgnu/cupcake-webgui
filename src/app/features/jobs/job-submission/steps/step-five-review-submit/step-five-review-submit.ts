import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JobSubmissionStateService } from '../../services/job-submission-state';
import { MetadataTableEditor } from '../../../../../features/metadata/metadata-table-editor/metadata-table-editor';

@Component({
  selector: 'app-step-five-review-submit',
  imports: [CommonModule, MetadataTableEditor],
  templateUrl: './step-five-review-submit.html',
  styleUrl: './step-five-review-submit.scss'
})
export class StepFiveReviewSubmitComponent {
  state = inject(JobSubmissionStateService);

  previous = output<void>();
  createMetadataTable = output<void>();
  submitJob = output<void>();

  onPrevious(): void {
    this.previous.emit();
  }

  onCreateMetadataTable(): void {
    this.createMetadataTable.emit();
  }

  onSubmitJob(): void {
    this.submitJob.emit();
  }
}
