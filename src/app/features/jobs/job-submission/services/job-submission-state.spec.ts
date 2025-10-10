import { TestBed } from '@angular/core/testing';

import { JobSubmissionState } from './job-submission-state';

describe('JobSubmissionState', () => {
  let service: JobSubmissionState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(JobSubmissionState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
