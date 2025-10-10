import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoredReagentAccessModal } from './stored-reagent-access-modal';

describe('StoredReagentAccessModal', () => {
  let component: StoredReagentAccessModal;
  let fixture: ComponentFixture<StoredReagentAccessModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoredReagentAccessModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoredReagentAccessModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
