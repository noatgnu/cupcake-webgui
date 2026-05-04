import { Component, inject, output } from '@angular/core';

import { JobSubmissionStateService } from '../../services/job-submission-state';
import { MetadataTableEditor } from '../../../../../features/metadata/metadata-table-editor/metadata-table-editor';

@Component({
  selector: 'app-step-six-staff-review',
  imports: [MetadataTableEditor],
  templateUrl: './step-six-staff-review.html',
  styleUrl: './step-six-staff-review.scss'
})
export class StepSixStaffReviewComponent {
  state = inject(JobSubmissionStateService);

  previous = output<void>();

  onPrevious(): void {
    this.previous.emit();
  }
}
