import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepFiveReviewSubmit } from './step-five-review-submit';

describe('StepFiveReviewSubmit', () => {
  let component: StepFiveReviewSubmit;
  let fixture: ComponentFixture<StepFiveReviewSubmit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepFiveReviewSubmit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepFiveReviewSubmit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
