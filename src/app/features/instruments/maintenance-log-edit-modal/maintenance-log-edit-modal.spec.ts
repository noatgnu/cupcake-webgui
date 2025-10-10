import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaintenanceLogEditModal } from './maintenance-log-edit-modal';

describe('MaintenanceLogEditModal', () => {
  let component: MaintenanceLogEditModal;
  let fixture: ComponentFixture<MaintenanceLogEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaintenanceLogEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaintenanceLogEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
