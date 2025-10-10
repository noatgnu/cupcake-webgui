import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabGroupPermissionsModal } from './lab-group-permissions-modal';

describe('LabGroupPermissionsModal', () => {
  let component: LabGroupPermissionsModal;
  let fixture: ComponentFixture<LabGroupPermissionsModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabGroupPermissionsModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabGroupPermissionsModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
