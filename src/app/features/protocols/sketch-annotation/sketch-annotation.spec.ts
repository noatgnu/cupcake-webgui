import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { CUPCAKE_CORE_CONFIG, ThemeService } from '@noatgnu/cupcake-core';
import { SketchAnnotation } from './sketch-annotation';

describe('SketchAnnotation', () => {
  let component: SketchAnnotation;
  let fixture: ComponentFixture<SketchAnnotation>;
  let mockThemeService: jasmine.SpyObj<ThemeService>;

  beforeEach(async () => {
    mockThemeService = jasmine.createSpyObj('ThemeService', ['toggleMode'], {
      isDark: signal(false)
    });

    await TestBed.configureTestingModule({
      imports: [SketchAnnotation],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: DOCUMENT, useValue: document }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SketchAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isErasing starts as false', () => {
    expect(component.isErasing()).toBeFalse();
  });

  it('toggleEraser() sets isErasing to true', () => {
    component.toggleEraser();
    expect(component.isErasing()).toBeTrue();
  });

  it('selectDrawingMode() sets isErasing to false', () => {
    component.isErasing.set(true);
    component.selectDrawingMode();
    expect(component.isErasing()).toBeFalse();
  });
});
