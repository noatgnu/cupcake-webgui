import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAnnotationModal } from './add-annotation-modal';

describe('AddAnnotationModal', () => {
  let component: AddAnnotationModal;
  let fixture: ComponentFixture<AddAnnotationModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAnnotationModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAnnotationModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
