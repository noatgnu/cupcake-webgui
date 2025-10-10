import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobAnnotationsSection } from './job-annotations-section';

describe('JobAnnotationsSection', () => {
  let component: JobAnnotationsSection;
  let fixture: ComponentFixture<JobAnnotationsSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobAnnotationsSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JobAnnotationsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
