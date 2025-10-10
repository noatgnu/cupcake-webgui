import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaintenanceLogAnnotationsModal } from './maintenance-log-annotations-modal';

describe('MaintenanceLogAnnotationsModal', () => {
  let component: MaintenanceLogAnnotationsModal;
  let fixture: ComponentFixture<MaintenanceLogAnnotationsModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaintenanceLogAnnotationsModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaintenanceLogAnnotationsModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
