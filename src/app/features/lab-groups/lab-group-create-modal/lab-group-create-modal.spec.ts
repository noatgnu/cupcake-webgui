import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabGroupCreateModal } from './lab-group-create-modal';

describe('LabGroupCreateModal', () => {
  let component: LabGroupCreateModal;
  let fixture: ComponentFixture<LabGroupCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabGroupCreateModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabGroupCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
