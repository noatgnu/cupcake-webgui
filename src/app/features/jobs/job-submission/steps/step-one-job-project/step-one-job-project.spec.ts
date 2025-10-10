import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepOneJobProject } from './step-one-job-project';

describe('StepOneJobProject', () => {
  let component: StepOneJobProject;
  let fixture: ComponentFixture<StepOneJobProject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepOneJobProject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepOneJobProject);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
