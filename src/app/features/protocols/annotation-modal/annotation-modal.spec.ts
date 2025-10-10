import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnotationModal } from './annotation-modal';

describe('AnnotationModal', () => {
  let component: AnnotationModal;
  let fixture: ComponentFixture<AnnotationModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotationModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnnotationModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
