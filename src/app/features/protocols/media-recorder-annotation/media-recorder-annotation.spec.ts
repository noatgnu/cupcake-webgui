import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaRecorderAnnotation } from './media-recorder-annotation';

describe('MediaRecorderAnnotation', () => {
  let component: MediaRecorderAnnotation;
  let fixture: ComponentFixture<MediaRecorderAnnotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaRecorderAnnotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MediaRecorderAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
