import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ApiService, CUPCAKE_CORE_CONFIG, ToastService } from '@noatgnu/cupcake-core';
import { InstrumentJobService } from '@noatgnu/cupcake-macaron';
import { JobEditModal } from './job-edit-modal';

describe('JobEditModal', () => {
  let component: JobEditModal;
  let fixture: ComponentFixture<JobEditModal>;

  beforeEach(async () => {
    const jobService = jasmine.createSpyObj('InstrumentJobService', ['getAutocompleteFields', 'updateInstrumentJob']);
    jobService.getAutocompleteFields.and.returnValue(of({
      funders: ['Wellcome'],
      costCenters: ['CC-1'],
      searchEngines: { MaxQuant: ['2.4'] }
    }));

    await TestBed.configureTestingModule({
      imports: [JobEditModal],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: InstrumentJobService, useValue: jobService },
        { provide: ApiService, useValue: jasmine.createSpyObj('ApiService', ['getUsers', 'getUser']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: NgbActiveModal, useValue: jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JobEditModal);
    component = fixture.componentInstance;
    component.job = { id: 1, jobName: 'Run', staff: [], canEditStaffOnlyColumns: false } as any;
    fixture.detectChanges();
  });

  it('offers the cost centres and search engines of earlier jobs', () => {
    expect(component.autocompleteData()).toEqual({
      funders: ['Wellcome'],
      cost_centers: ['CC-1'],
      search_engines: { MaxQuant: ['2.4'] }
    });
    component.searchEngine.set('MaxQuant');
    expect(component.searchEngineVersions()).toEqual(['2.4']);
  });
});
