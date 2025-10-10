import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepEditModal } from './step-edit-modal';

describe('StepEditModal', () => {
  let component: StepEditModal;
  let fixture: ComponentFixture<StepEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
