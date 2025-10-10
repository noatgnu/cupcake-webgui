import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JobAnnotations } from '../../job-annotations/job-annotations';

@Component({
  selector: 'app-job-annotations-section',
  imports: [CommonModule, JobAnnotations],
  templateUrl: './job-annotations-section.html',
  styleUrl: './job-annotations-section.scss',
})
export class JobAnnotationsSection {
  @Input() jobId!: number;
  @Input() canEditStaffOnly = false;
  @Input() isJobOwner = false;
}
