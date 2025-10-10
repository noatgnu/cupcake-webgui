import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StorageEditModal } from './storage-edit-modal';

describe('StorageEditModal', () => {
  let component: StorageEditModal;
  let fixture: ComponentFixture<StorageEditModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageEditModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StorageEditModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
