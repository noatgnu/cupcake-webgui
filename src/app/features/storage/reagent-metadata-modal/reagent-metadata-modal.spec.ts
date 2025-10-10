import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReagentMetadataModal } from './reagent-metadata-modal';

describe('ReagentMetadataModal', () => {
  let component: ReagentMetadataModal;
  let fixture: ComponentFixture<ReagentMetadataModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReagentMetadataModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReagentMetadataModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
