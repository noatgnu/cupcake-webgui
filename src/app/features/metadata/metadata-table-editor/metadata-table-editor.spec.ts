import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CUPCAKE_CORE_CONFIG, ToastService, SiteConfigService } from '@noatgnu/cupcake-core';
import {
  MetadataTableService, MetadataColumnService, ChunkedUploadService,
  AsyncTaskUIService, SamplePoolService
} from '@noatgnu/cupcake-vanilla';
import { MetadataTableEditor } from './metadata-table-editor';

describe('MetadataTableEditor', () => {
  let component: MetadataTableEditor;
  let fixture: ComponentFixture<MetadataTableEditor>;

  beforeEach(async () => {
    const mockMetadataTableService = jasmine.createSpyObj('MetadataTableService', ['getMetadataTable', 'updateMetadataTable']);
    const mockMetadataColumnService = jasmine.createSpyObj('MetadataColumnService', ['updateMetadataColumn', 'deleteMetadataColumn']);
    const mockChunkedUploadService = jasmine.createSpyObj('ChunkedUploadService', ['upload']);
    const mockSamplePoolService = jasmine.createSpyObj('SamplePoolService', ['getSamplePools', 'createSamplePool']);
    const mockModalService = jasmine.createSpyObj('NgbModal', ['open']);
    const mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'show']);
    const mockSiteConfigService = jasmine.createSpyObj('SiteConfigService', ['getMaxChunkedUploadSize', 'formatFileSize'], {
      siteConfig: signal({ uiFeaturesWithDefaults: {} })
    });
    mockSiteConfigService.getMaxChunkedUploadSize.and.returnValue(100 * 1024 * 1024);
    mockSiteConfigService.formatFileSize.and.returnValue('100 MB');

    const mockAsyncTaskService = jasmine.createSpyObj('AsyncTaskUIService', ['monitorTask', 'queueSdrfExport', 'queueExcelExport'], {
      tasks: signal([]),
      activeTasks: signal([]),
      metadataTableRefresh$: new Subject<number>().asObservable(),
      taskCompleted$: new Subject<any>().asObservable(),
      exportTaskCompleted$: new Subject<any>().asObservable()
    });

    await TestBed.configureTestingModule({
      imports: [MetadataTableEditor],
      providers: [
        { provide: CUPCAKE_CORE_CONFIG, useValue: { apiUrl: 'http://localhost:8000' } },
        { provide: MetadataTableService, useValue: mockMetadataTableService },
        { provide: MetadataColumnService, useValue: mockMetadataColumnService },
        { provide: ChunkedUploadService, useValue: mockChunkedUploadService },
        { provide: AsyncTaskUIService, useValue: mockAsyncTaskService },
        { provide: SamplePoolService, useValue: mockSamplePoolService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: ToastService, useValue: mockToastService },
        { provide: SiteConfigService, useValue: mockSiteConfigService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MetadataTableEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('table signal starts as null', () => {
    expect(component.table()).toBeNull();
  });

  it('isLoading starts as false', () => {
    expect(component.isLoading()).toBeFalse();
  });
});
