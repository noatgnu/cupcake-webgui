import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG } from '@noatgnu/cupcake-core';
import { StorageService } from '@noatgnu/cupcake-macaron';
import { StorageForm } from './storage-form';

describe('StorageForm', () => {
  let component: StorageForm;
  let fixture: ComponentFixture<StorageForm>;

  beforeEach(async () => {
    const mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);
    const mockStorageService = jasmine.createSpyObj('StorageService', [
      'createStorageObject', 'updateStorageObject'
    ]);

    await TestBed.configureTestingModule({
      imports: [StorageForm],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: StorageService, useValue: mockStorageService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StorageForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submitting signal starts as false', () => {
    expect(component.submitting()).toBeFalse();
  });
});
