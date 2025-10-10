import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoredReagentEditModal } from './stored-reagent-edit-modal';

describe('StoredReagentEditModal', () => {
  let component: StoredReagentEditModal;
  let fixture: ComponentFixture<StoredReagentEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoredReagentEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoredReagentEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
