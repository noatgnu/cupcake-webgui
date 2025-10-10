import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StorageAccessModal } from './storage-access-modal';

describe('StorageAccessModal', () => {
  let component: StorageAccessModal;
  let fixture: ComponentFixture<StorageAccessModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageAccessModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StorageAccessModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
