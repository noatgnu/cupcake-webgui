import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { ReagentService } from '@noatgnu/cupcake-macaron';
import { MolarityCalculatorAnnotation } from './molarity-calculator-annotation';

describe('MolarityCalculatorAnnotation', () => {
  let component: MolarityCalculatorAnnotation;
  let fixture: ComponentFixture<MolarityCalculatorAnnotation>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockReagentService: jasmine.SpyObj<ReagentService>;

  beforeEach(async () => {
    mockToastService = jasmine.createSpyObj('ToastService', ['show', 'success', 'error', 'info']);

    mockReagentService = jasmine.createSpyObj('ReagentService', ['getStoredReagents', 'getReagents']);
    mockReagentService.getStoredReagents.and.returnValue(of({ count: 0, results: [] }));
    mockReagentService.getReagents.and.returnValue(of({ count: 0, results: [] }));

    await TestBed.configureTestingModule({
      imports: [MolarityCalculatorAnnotation],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: ToastService, useValue: mockToastService },
        { provide: ReagentService, useValue: mockReagentService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MolarityCalculatorAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty dataLog signal', () => {
    expect(component.dataLog()).toEqual([]);
  });

  it('should default concentration signal to null', () => {
    expect(component.concentration()).toBeNull();
  });
});
