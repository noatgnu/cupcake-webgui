import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { StoredReagentAnnotationsModal } from './stored-reagent-annotations-modal';

describe('StoredReagentAnnotationsModal', () => {
  let component: StoredReagentAnnotationsModal;
  let fixture: ComponentFixture<StoredReagentAnnotationsModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoredReagentAnnotationsModal],
      providers: [
        NgbActiveModal,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoredReagentAnnotationsModal);
    component = fixture.componentInstance;
    component.storedReagent = {
      id: 1,
      reagent: 1,
      reagentName: 'Test Reagent',
      quantity: 100,
      currentQuantity: 100,
      shareable: false,
      accessAll: false,
      notifyOnLowStock: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have three allowed folder names', () => {
    expect(component.allowedFolderNames).toEqual(['MSDS', 'Certificates', 'Manuals']);
  });

  it('should load folders on init', () => {
    expect(component.loading()).toBe(true);
  });
});
