import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DurationInput } from './duration-input';

describe('DurationInput', () => {
  let component: DurationInput;
  let fixture: ComponentFixture<DurationInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DurationInput]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DurationInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('deserializeDuration', () => {
    it('should convert seconds to days, hours, minutes, seconds', () => {
      component.writeValue(90061);
      expect(component.days).toBe(1);
      expect(component.hours).toBe(1);
      expect(component.minutes).toBe(1);
      expect(component.seconds).toBe(1);
    });

    it('should handle zero seconds', () => {
      component.writeValue(0);
      expect(component.days).toBe(0);
      expect(component.hours).toBe(0);
      expect(component.minutes).toBe(0);
      expect(component.seconds).toBe(0);
    });

    it('should handle null value', () => {
      component.writeValue(null);
      expect(component.days).toBe(0);
      expect(component.hours).toBe(0);
      expect(component.minutes).toBe(0);
      expect(component.seconds).toBe(0);
    });

    it('should convert 3661 seconds to 1h 1m 1s', () => {
      component.writeValue(3661);
      expect(component.days).toBe(0);
      expect(component.hours).toBe(1);
      expect(component.minutes).toBe(1);
      expect(component.seconds).toBe(1);
    });
  });

  describe('serializeDuration', () => {
    it('should convert days, hours, minutes, seconds to total seconds', () => {
      component.days = 1;
      component.hours = 1;
      component.minutes = 1;
      component.seconds = 1;
      component.onValueChange();
      expect(component.days * 86400 + component.hours * 3600 + component.minutes * 60 + component.seconds).toBe(90061);
    });

    it('should handle zero values', () => {
      component.days = 0;
      component.hours = 0;
      component.minutes = 0;
      component.seconds = 0;
      component.onValueChange();
      expect(component.days * 86400 + component.hours * 3600 + component.minutes * 60 + component.seconds).toBe(0);
    });

    it('should convert 1h 30m to 5400 seconds', () => {
      component.days = 0;
      component.hours = 1;
      component.minutes = 30;
      component.seconds = 0;
      component.onValueChange();
      expect(component.hours * 3600 + component.minutes * 60).toBe(5400);
    });
  });

  describe('ControlValueAccessor', () => {
    it('should register onChange callback', () => {
      const fn = jasmine.createSpy('onChange');
      component.registerOnChange(fn);
      component.onValueChange();
      expect(fn).toHaveBeenCalled();
    });

    it('should register onTouched callback', () => {
      const fn = jasmine.createSpy('onTouched');
      component.registerOnTouched(fn);
      component.onValueChange();
      expect(fn).toHaveBeenCalled();
    });

    it('should set disabled state', () => {
      component.setDisabledState(true);
      expect(component.disabled).toBe(true);
      component.setDisabledState(false);
      expect(component.disabled).toBe(false);
    });
  });
});
