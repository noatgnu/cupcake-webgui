import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StorageForm } from './storage-form';

describe('StorageForm', () => {
  let component: StorageForm;
  let fixture: ComponentFixture<StorageForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StorageForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
