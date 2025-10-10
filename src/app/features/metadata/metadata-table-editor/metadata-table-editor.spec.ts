import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetadataTableEditor } from './metadata-table-editor';

describe('MetadataTableEditor', () => {
  let component: MetadataTableEditor;
  let fixture: ComponentFixture<MetadataTableEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetadataTableEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MetadataTableEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
