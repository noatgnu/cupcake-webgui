import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { MediaRecorderAnnotation } from './media-recorder-annotation';

describe('MediaRecorderAnnotation', () => {
  let component: MediaRecorderAnnotation;
  let fixture: ComponentFixture<MediaRecorderAnnotation>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);

    const mockMediaDevices = {
      enumerateDevices: () => Promise.resolve([]),
      getUserMedia: () => Promise.reject(new Error('not available')),
      getDisplayMedia: () => Promise.reject(new Error('not available'))
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true
    });

    await TestBed.configureTestingModule({
      imports: [MediaRecorderAnnotation],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MediaRecorderAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isRecording starts as false', () => {
    expect(component.recording()).toBeFalse();
  });
});
