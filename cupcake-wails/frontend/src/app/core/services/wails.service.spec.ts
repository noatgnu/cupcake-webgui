import { TestBed } from '@angular/core/testing';
import { WailsService } from './wails.service';

describe('WailsService', () => {
  let service: WailsService;

  beforeEach(() => {
    delete (window as any)._wails;
    TestBed.configureTestingModule({});
    service = TestBed.inject(WailsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isWails detection', () => {
    it('should detect Wails environment when window._wails exists', () => {
      (window as any)._wails = { invoke: () => {} };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const testService = TestBed.inject(WailsService);
      expect(testService.isWails).toBe(true);
      delete (window as any)._wails;
    });

    it('should not detect Wails when window._wails does not exist', () => {
      delete (window as any)._wails;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const testService = TestBed.inject(WailsService);
      expect(testService.isWails).toBe(false);
    });
  });

  describe('signals', () => {
    it('should have backendStatus signal initialized to null', () => {
      expect(service.backendStatus()).toBeNull();
    });

    it('should have backendLog signal initialized to null', () => {
      expect(service.backendLog()).toBeNull();
    });

    it('should have downloadProgress signal initialized to null', () => {
      expect(service.downloadProgress()).toBeNull();
    });

    it('should have downloadComplete signal initialized to null', () => {
      expect(service.downloadComplete()).toBeNull();
    });

    it('should have logs signal initialized to empty array', () => {
      expect(service.logs()).toEqual([]);
    });

    it('should have serviceStatuses signal initialized to empty Map', () => {
      expect(service.serviceStatuses().size).toBe(0);
    });

    it('should have showPythonSelection signal initialized to false', () => {
      expect(service.showPythonSelection()).toBe(false);
    });

    it('should have showBackendDownload signal initialized to false', () => {
      expect(service.showBackendDownload()).toBe(false);
    });

    it('should have showValkeyDownload signal initialized to false', () => {
      expect(service.showValkeyDownload()).toBe(false);
    });

    it('should have showSuperuserCreation signal initialized to false', () => {
      expect(service.showSuperuserCreation()).toBe(false);
    });
  });

  describe('dismiss methods', () => {
    it('dismissPythonSelection should set showPythonSelection to false', () => {
      service.dismissPythonSelection();
      expect(service.showPythonSelection()).toBe(false);
    });

    it('dismissBackendDownload should set showBackendDownload to false', () => {
      service.dismissBackendDownload();
      expect(service.showBackendDownload()).toBe(false);
    });

    it('dismissValkeyDownload should set showValkeyDownload to false', () => {
      service.dismissValkeyDownload();
      expect(service.showValkeyDownload()).toBe(false);
    });

    it('dismissSuperuserCreation should set showSuperuserCreation to false', () => {
      service.dismissSuperuserCreation();
      expect(service.showSuperuserCreation()).toBe(false);
    });
  });

  describe('clearLogs', () => {
    it('should clear the logs array', () => {
      service.clearLogs();
      expect(service.logs()).toEqual([]);
    });
  });

  describe('resetDownloadProgress', () => {
    it('should reset downloadProgress and downloadComplete to null', () => {
      service.resetDownloadProgress();
      expect(service.downloadProgress()).toBeNull();
      expect(service.downloadComplete()).toBeNull();
    });
  });

  describe('getServiceStatus', () => {
    it('should return undefined for non-existent service', () => {
      expect(service.getServiceStatus('nonexistent')).toBeUndefined();
    });
  });

  describe('fallback behavior when not in Wails', () => {
    beforeEach(() => {
      delete (window as any)._wails;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      service = TestBed.inject(WailsService);
    });

    it('getAppVersion should return default version', async () => {
      const version = await service.getAppVersion();
      expect(version).toBe('0.0.1');
    });

    it('getBackendPort should return default port', async () => {
      const port = await service.getBackendPort();
      expect(port).toBe(8000);
    });

    it('isBackendReady should return false', async () => {
      const ready = await service.isBackendReady();
      expect(ready).toBe(false);
    });

    it('detectPythonCandidates should return empty array', async () => {
      const candidates = await service.detectPythonCandidates();
      expect(candidates).toEqual([]);
    });

    it('verifyPython should return invalid result', async () => {
      const result = await service.verifyPython('/path/to/python');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Wails not available');
    });

    it('getAvailableReleases should return empty array', async () => {
      const releases = await service.getAvailableReleases();
      expect(releases).toEqual([]);
    });

    it('openFile should return empty string', async () => {
      const file = await service.openFile('Select File');
      expect(file).toBe('');
    });

    it('openDirectory should return empty string', async () => {
      const dir = await service.openDirectory('Select Directory');
      expect(dir).toBe('');
    });

    it('getLogFilePath should return empty string', async () => {
      const path = await service.getLogFilePath();
      expect(path).toBe('');
    });

    it('getSchemaCount should return 0', async () => {
      const count = await service.getSchemaCount();
      expect(count).toBe(0);
    });

    it('getColumnTemplateCount should return 0', async () => {
      const count = await service.getColumnTemplateCount();
      expect(count).toBe(0);
    });

    it('getOntologyCounts should return empty object', async () => {
      const counts = await service.getOntologyCounts();
      expect(counts).toEqual({});
    });

    it('listBackups should return empty array', async () => {
      const backups = await service.listBackups();
      expect(backups).toEqual([]);
    });

    it('createDatabaseBackup should return without error', async () => {
      await expectAsync(service.createDatabaseBackup()).toBeResolved();
    });

    it('createMediaBackup should return without error', async () => {
      await expectAsync(service.createMediaBackup()).toBeResolved();
    });

    it('createFullBackup should return without error', async () => {
      await expectAsync(service.createFullBackup()).toBeResolved();
    });

    it('restoreDatabase should return without error', async () => {
      await expectAsync(service.restoreDatabase()).toBeResolved();
    });

    it('restoreMedia should return without error', async () => {
      await expectAsync(service.restoreMedia()).toBeResolved();
    });

    it('deleteBackup should return without error', async () => {
      await expectAsync(service.deleteBackup('/path/to/backup')).toBeResolved();
    });

    it('openBackupFolder should return without error', async () => {
      await expectAsync(service.openBackupFolder()).toBeResolved();
    });

    it('getBackupDirectory should return empty string', async () => {
      const dir = await service.getBackupDirectory();
      expect(dir).toBe('');
    });

    it('getDefaultBackupDirectory should return empty string', async () => {
      const dir = await service.getDefaultBackupDirectory();
      expect(dir).toBe('');
    });

    it('setBackupDirectory should return without error', async () => {
      await expectAsync(service.setBackupDirectory('/path/to/backups')).toBeResolved();
    });

    it('resetBackupDirectory should return without error', async () => {
      await expectAsync(service.resetBackupDirectory()).toBeResolved();
    });

    it('selectBackupDirectory should return empty string', async () => {
      const dir = await service.selectBackupDirectory();
      expect(dir).toBe('');
    });

    it('checkForBackendUpdates should return null', async () => {
      const result = await service.checkForBackendUpdates();
      expect(result).toBeNull();
    });

    it('updateBackend should return null', async () => {
      const result = await service.updateBackend('v1.0.0', true);
      expect(result).toBeNull();
    });

    it('getCurrentBackendVersion should return unknown', async () => {
      const version = await service.getCurrentBackendVersion();
      expect(version).toBe('unknown');
    });

    it('rollbackBackend should return without error', async () => {
      await expectAsync(service.rollbackBackend()).toBeResolved();
    });

    it('importInitialDatabase should return without error', async () => {
      await expectAsync(service.importInitialDatabase()).toBeResolved();
    });
  });
});
