import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobSubmission } from './job-submission';

describe('JobSubmission', () => {
  let component: JobSubmission;
  let fixture: ComponentFixture<JobSubmission>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobSubmission]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JobSubmission);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
