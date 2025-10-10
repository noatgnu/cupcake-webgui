import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabGroupInviteModal } from './lab-group-invite-modal';

describe('LabGroupInviteModal', () => {
  let component: LabGroupInviteModal;
  let fixture: ComponentFixture<LabGroupInviteModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabGroupInviteModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabGroupInviteModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
