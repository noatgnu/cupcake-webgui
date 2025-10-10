import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepFourTemplate } from './step-four-template';

describe('StepFourTemplate', () => {
  let component: StepFourTemplate;
  let fixture: ComponentFixture<StepFourTemplate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepFourTemplate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepFourTemplate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
