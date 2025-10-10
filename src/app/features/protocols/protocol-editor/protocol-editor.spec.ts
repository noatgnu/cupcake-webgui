import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProtocolEditor } from './protocol-editor';

describe('ProtocolEditor', () => {
  let component: ProtocolEditor;
  let fixture: ComponentFixture<ProtocolEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProtocolEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProtocolEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
