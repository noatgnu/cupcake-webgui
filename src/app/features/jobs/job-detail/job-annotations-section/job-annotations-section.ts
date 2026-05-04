import { Component, Input } from '@angular/core';

import { JobAnnotations } from '../../job-annotations/job-annotations';

@Component({
  selector: 'app-job-annotations-section',
  imports: [JobAnnotations],
  templateUrl: './job-annotations-section.html',
  styleUrl: './job-annotations-section.scss',
})
export class JobAnnotationsSection {
  @Input() jobId!: number;
  @Input() canEditStaffOnly = false;
  @Input() isJobOwner = false;
}
