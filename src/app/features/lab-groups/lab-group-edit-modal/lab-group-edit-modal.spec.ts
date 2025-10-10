import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabGroupEditModal } from './lab-group-edit-modal';

describe('LabGroupEditModal', () => {
  let component: LabGroupEditModal;
  let fixture: ComponentFixture<LabGroupEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabGroupEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabGroupEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
