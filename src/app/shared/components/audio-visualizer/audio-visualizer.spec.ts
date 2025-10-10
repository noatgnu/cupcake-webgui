import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioVisualizer } from './audio-visualizer';

describe('AudioVisualizer', () => {
  let component: AudioVisualizer;
  let fixture: ComponentFixture<AudioVisualizer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioVisualizer],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioVisualizer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize canvas with correct dimensions', () => {
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(100);
  });

  it('should use custom dimensions when provided', () => {
    component.width = 600;
    component.height = 150;
    component.ngOnInit();

    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(150);
  });

  it('should show inactive state by default', () => {
    expect(component.isActive()).toBe(false);
  });

  it('should cleanup on destroy', () => {
    const stopVisualizationSpy = spyOn<any>(component, 'stopVisualization');
    component.ngOnDestroy();
    expect(stopVisualizationSpy).toHaveBeenCalled();
  });
});
