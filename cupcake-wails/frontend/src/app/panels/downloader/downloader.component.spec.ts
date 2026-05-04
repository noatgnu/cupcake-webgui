import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DownloaderComponent } from './downloader.component';
import { WailsService, ReleaseInfo, PythonCandidate, DownloadProgress, DownloadComplete } from '../../core/services/wails.service';
import { signal, WritableSignal } from '@angular/core';

describe('DownloaderComponent', () => {
  let component: DownloaderComponent;
  let fixture: ComponentFixture<DownloaderComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;
  let downloadProgressSignal: WritableSignal<DownloadProgress | null>;
  let downloadCompleteSignal: WritableSignal<DownloadComplete | null>;

  const mockReleases: ReleaseInfo[] = [
    { tag: 'master', name: 'Latest (master branch)', publishedAt: '' },
    { tag: 'v1.0.0', name: 'Release v1.0.0', publishedAt: '2025-01-01T00:00:00Z' }
  ];

  const mockPythonCandidates: PythonCandidate[] = [
    { command: 'python3.12', version: '3.12.0', path: '/usr/bin/python3.12' },
    { command: 'python3.11', version: '3.11.0', path: '/usr/bin/python3.11' }
  ];

  beforeEach(async () => {
    downloadProgressSignal = signal<DownloadProgress | null>(null);
    downloadCompleteSignal = signal<DownloadComplete | null>(null);

    mockWailsService = jasmine.createSpyObj('WailsService', [
      'getAvailableReleases',
      'detectPythonCandidates',
      'downloadPortableBackend',
      'setupNativeBackend',
      'downloadValkey'
    ], {
      downloadProgress: downloadProgressSignal.asReadonly(),
      downloadComplete: downloadCompleteSignal.asReadonly()
    });

    mockWailsService.getAvailableReleases.and.resolveTo(mockReleases);
    mockWailsService.detectPythonCandidates.and.resolveTo(mockPythonCandidates);
    mockWailsService.downloadPortableBackend.and.resolveTo();
    mockWailsService.setupNativeBackend.and.resolveTo();
    mockWailsService.downloadValkey.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [DownloaderComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DownloaderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('backend download', () => {
    beforeEach(() => {
      component.downloadType = 'backend';
      fixture.detectChanges();
    });

    it('should load releases on init', async () => {
      await component.ngOnInit();
      expect(mockWailsService.getAvailableReleases).toHaveBeenCalled();
      expect(component.releases()).toEqual(mockReleases);
    });

    it('should load python candidates on init', async () => {
      await component.ngOnInit();
      expect(mockWailsService.detectPythonCandidates).toHaveBeenCalled();
      expect(component.pythonCandidates()).toEqual(mockPythonCandidates);
    });

    it('should auto-select first release and python candidate', async () => {
      await component.ngOnInit();
      expect(component.selectedVersion()).toBe('master');
      expect(component.selectedBranch()).toBe('master');
      expect(component.selectedPython()).toBe('/usr/bin/python3.12');
    });

    it('should default to portable distribution mode', () => {
      expect(component.distributionMode()).toBe('portable');
    });

    it('should switch distribution mode', () => {
      component.setDistributionMode('native');
      expect(component.distributionMode()).toBe('native');
    });

    it('should show correct title for portable mode', async () => {
      await component.ngOnInit();
      component.setDistributionMode('portable');
      expect(component.title()).toBe('Setup Backend');
      expect(component.description()).toContain('portable');
    });

    it('should show correct title for native mode', async () => {
      await component.ngOnInit();
      component.setDistributionMode('native');
      expect(component.description()).toContain('system Python');
    });

    it('should enable download when version selected in portable mode', async () => {
      await component.ngOnInit();
      component.setDistributionMode('portable');
      expect(component.canDownload()).toBeTrue();
    });

    it('should require both python and branch for native mode', async () => {
      await component.ngOnInit();
      component.setDistributionMode('native');
      component.selectedPython.set('');
      expect(component.canDownload()).toBeFalse();

      component.selectedPython.set('/usr/bin/python3.12');
      component.selectedBranch.set('');
      expect(component.canDownload()).toBeFalse();

      component.selectedBranch.set('master');
      expect(component.canDownload()).toBeTrue();
    });

    it('should call downloadPortableBackend for portable mode', async () => {
      await component.ngOnInit();
      component.setDistributionMode('portable');
      await component.startDownload();
      expect(mockWailsService.downloadPortableBackend).toHaveBeenCalledWith('master');
    });

    it('should call setupNativeBackend for native mode', async () => {
      await component.ngOnInit();
      component.setDistributionMode('native');
      await component.startDownload();
      expect(mockWailsService.setupNativeBackend).toHaveBeenCalledWith('/usr/bin/python3.12', 'master');
    });
  });

  describe('valkey download', () => {
    beforeEach(() => {
      component.downloadType = 'valkey';
      fixture.detectChanges();
    });

    it('should show correct title', () => {
      expect(component.title()).toBe('Download Redis/Valkey');
    });

    it('should enable download without version selection', () => {
      expect(component.canDownload()).toBeTrue();
    });

    it('should call downloadValkey', async () => {
      await component.startDownload();
      expect(mockWailsService.downloadValkey).toHaveBeenCalled();
    });
  });

  describe('download progress', () => {
    beforeEach(async () => {
      component.downloadType = 'backend';
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should update progress from service', () => {
      const progress: DownloadProgress = { downloaded: 500, total: 1000, percentage: 50, speed: 100 };
      downloadProgressSignal.set(progress);
      fixture.detectChanges();
      expect(component.progress()).toEqual(progress);
    });

    it('should handle download complete success', () => {
      component.downloading.set(true);
      downloadCompleteSignal.set({ success: true, message: 'Done!' });
      fixture.detectChanges();
      expect(component.downloading()).toBeFalse();
      expect(component.success()).toBeTrue();
      expect(component.successMessage()).toBe('Done!');
    });

    it('should handle download complete failure', () => {
      component.downloading.set(true);
      downloadCompleteSignal.set({ success: false, message: 'Failed!' });
      fixture.detectChanges();
      expect(component.downloading()).toBeFalse();
      expect(component.success()).toBeFalse();
      expect(component.error()).toBe('Failed!');
    });
  });

  describe('formatting', () => {
    it('should format date correctly', () => {
      const result = component.formatDate('2025-01-15T00:00:00Z');
      expect(result).toBeTruthy();
    });

    it('should handle empty date', () => {
      expect(component.formatDate('')).toBe('');
    });

    it('should format size correctly', () => {
      expect(component.formatSize(0)).toBe('0 B');
      expect(component.formatSize(1024)).toBe('1 KB');
      expect(component.formatSize(1048576)).toBe('1 MB');
    });

    it('should format speed correctly', () => {
      expect(component.formatSpeed(1024)).toBe('1 KB/s');
    });
  });
});
