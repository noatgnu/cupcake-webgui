import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalculatorAnnotation } from './calculator-annotation';

describe('CalculatorAnnotation', () => {
  let component: CalculatorAnnotation;
  let fixture: ComponentFixture<CalculatorAnnotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalculatorAnnotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalculatorAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
