import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StorageNavbar } from './storage-navbar';

describe('StorageNavbar', () => {
  let component: StorageNavbar;
  let fixture: ComponentFixture<StorageNavbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageNavbar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StorageNavbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
