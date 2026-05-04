import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { CalculatorAnnotation } from './calculator-annotation';

describe('CalculatorAnnotation', () => {
  let component: CalculatorAnnotation;
  let fixture: ComponentFixture<CalculatorAnnotation>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    await TestBed.configureTestingModule({
      imports: [CalculatorAnnotation],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CalculatorAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('initial display is 0', () => {
    expect(component.currentDisplay()).toBe('0');
  });

  it('formNumber() appends digit to display', () => {
    component.formNumber(5);
    expect(component.currentDisplay()).toBe('5');
  });

  it('formOperation() with = executes binary operation and resets mode', () => {
    component.formNumber(4);
    component.formOperation('+');
    component.formNumber(6);
    component.formOperation('=');
    expect(component.currentDisplay()).toBe('10');
    expect(component.executionMode()).toBe('initial');
  });

  it('clearAll() resets display to 0', () => {
    component.formNumber(9);
    component.clearAll();
    expect(component.currentDisplay()).toBe('0');
  });

  it('division by zero calls toastService.error', () => {
    component.formNumber(5);
    component.formOperation('/');
    component.formNumber(0);
    component.formOperation('=');
    expect(mockToastService.error).toHaveBeenCalledWith('Cannot divide by zero');
  });
});
