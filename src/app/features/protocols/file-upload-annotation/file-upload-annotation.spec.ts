import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileUploadAnnotation } from './file-upload-annotation';

describe('FileUploadAnnotation', () => {
  let component: FileUploadAnnotation;
  let fixture: ComponentFixture<FileUploadAnnotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileUploadAnnotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileUploadAnnotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
