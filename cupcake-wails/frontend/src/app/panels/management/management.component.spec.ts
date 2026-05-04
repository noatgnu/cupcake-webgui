import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManagementComponent } from './management.component';
import { WailsService, CommandOutput, SyncSchemasOptions, LoadColumnTemplatesOptions, LoadOntologiesOptions, BackupInfo } from '../../core/services/wails.service';
import { signal, WritableSignal } from '@angular/core';

describe('ManagementComponent', () => {
  let component: ManagementComponent;
  let fixture: ComponentFixture<ManagementComponent>;
  let mockWailsService: jasmine.SpyObj<WailsService>;
  let commandOutputSignal: WritableSignal<CommandOutput | null>;

  const mockOntologyCounts = {
    psims: 100,
    cell: 200,
    mondo: 300,
    uberon: 400,
    total: 1000
  };

  const mockBackups: BackupInfo[] = [
    { name: 'default-db-2024-01-01.sqlite3.gz', path: '/backups/default-db-2024-01-01.sqlite3.gz', size: 1024000, createdAt: '2024-01-01T12:00:00Z', type: 'database' },
    { name: 'media-2024-01-01.tar.gz', path: '/backups/media-2024-01-01.tar.gz', size: 2048000, createdAt: '2024-01-01T12:00:00Z', type: 'media' }
  ];

  beforeEach(async () => {
    commandOutputSignal = signal<CommandOutput | null>(null);

    mockWailsService = jasmine.createSpyObj('WailsService', [
      'getSchemaCount',
      'getColumnTemplateCount',
      'getOntologyCounts',
      'runSyncSchemas',
      'runLoadColumnTemplates',
      'runLoadOntologies',
      'logToFile',
      'listBackups',
      'createDatabaseBackup',
      'createMediaBackup',
      'restoreDatabase',
      'restoreMedia',
      'deleteBackup',
      'openBackupFolder',
      'importInitialDatabase'
    ], {
      commandOutput: commandOutputSignal.asReadonly(),
      isWails: false
    });

    mockWailsService.getSchemaCount.and.resolveTo(10);
    mockWailsService.getColumnTemplateCount.and.resolveTo(50);
    mockWailsService.getOntologyCounts.and.resolveTo(mockOntologyCounts);
    mockWailsService.runSyncSchemas.and.resolveTo();
    mockWailsService.runLoadColumnTemplates.and.resolveTo();
    mockWailsService.runLoadOntologies.and.resolveTo();
    mockWailsService.listBackups.and.resolveTo(mockBackups);
    mockWailsService.createDatabaseBackup.and.resolveTo();
    mockWailsService.createMediaBackup.and.resolveTo();
    mockWailsService.restoreDatabase.and.resolveTo();
    mockWailsService.restoreMedia.and.resolveTo();
    mockWailsService.deleteBackup.and.resolveTo();
    mockWailsService.openBackupFolder.and.resolveTo();
    mockWailsService.importInitialDatabase.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ManagementComponent],
      providers: [
        { provide: WailsService, useValue: mockWailsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManagementComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have eight commands', () => {
    expect(component.commands().length).toBe(8);
  });

  it('should have sync-schemas command', () => {
    const cmd = component.commands().find(c => c.name === 'sync-schemas');
    expect(cmd).toBeTruthy();
    expect(cmd?.displayName).toBe('SDRF Schema Synchronization');
  });

  it('should have load-column-templates command', () => {
    const cmd = component.commands().find(c => c.name === 'load-column-templates');
    expect(cmd).toBeTruthy();
  });

  it('should have load-ontologies command', () => {
    const cmd = component.commands().find(c => c.name === 'load-ontologies');
    expect(cmd).toBeTruthy();
  });

  it('should have backup-database command', () => {
    const cmd = component.commands().find(c => c.name === 'backup-database');
    expect(cmd).toBeTruthy();
    expect(cmd?.displayName).toBe('Database Backup');
  });

  it('should have backup-media command', () => {
    const cmd = component.commands().find(c => c.name === 'backup-media');
    expect(cmd).toBeTruthy();
    expect(cmd?.displayName).toBe('Media Backup');
  });

  it('should have restore-database command', () => {
    const cmd = component.commands().find(c => c.name === 'restore-database');
    expect(cmd).toBeTruthy();
    expect(cmd?.displayName).toBe('Restore Database');
  });

  it('should have restore-media command', () => {
    const cmd = component.commands().find(c => c.name === 'restore-media');
    expect(cmd).toBeTruthy();
    expect(cmd?.displayName).toBe('Restore Media');
  });

  it('should have import-initial-database command', () => {
    const cmd = component.commands().find(c => c.name === 'import-initial-database');
    expect(cmd).toBeTruthy();
    expect(cmd?.displayName).toBe('Import Pre-built Database');
  });

  it('should start with empty output lines', () => {
    expect(component.outputLines().length).toBe(0);
  });

  describe('ngOnInit', () => {
    it('should refresh stats on init', async () => {
      await component.ngOnInit();
      expect(mockWailsService.getSchemaCount).toHaveBeenCalled();
      expect(mockWailsService.getColumnTemplateCount).toHaveBeenCalled();
      expect(mockWailsService.getOntologyCounts).toHaveBeenCalled();
    });

    it('should set schema count', async () => {
      await component.ngOnInit();
      expect(component.schemaCount()).toBe(10);
    });

    it('should set column template count', async () => {
      await component.ngOnInit();
      expect(component.columnTemplateCount()).toBe(50);
    });

    it('should set ontology counts', async () => {
      await component.ngOnInit();
      expect(component.ontologyCounts()).toEqual(mockOntologyCounts);
    });
  });

  describe('ontologyTotal', () => {
    it('should return total from ontology counts', async () => {
      await component.ngOnInit();
      expect(component.ontologyTotal()).toBe(1000);
    });

    it('should return 0 when no counts', () => {
      expect(component.ontologyTotal()).toBe(0);
    });
  });

  describe('ontologyBreakdown', () => {
    it('should return breakdown with counts > 0', async () => {
      await component.ngOnInit();
      const breakdown = component.ontologyBreakdown();
      expect(breakdown.length).toBeGreaterThan(0);
      expect(breakdown.every(item => item.count > 0)).toBeTrue();
    });

    it('should uppercase names', async () => {
      await component.ngOnInit();
      const breakdown = component.ontologyBreakdown();
      expect(breakdown.every(item => item.name === item.name.toUpperCase())).toBeTrue();
    });
  });

  describe('refreshStats', () => {
    it('should update command counts', async () => {
      await component.refreshStats();
      const syncCmd = component.commands().find(c => c.name === 'sync-schemas');
      expect(syncCmd?.count).toBe(10);
    });
  });

  describe('runCommand', () => {
    beforeEach(async () => {
      fixture.detectChanges();
    });

    it('should run sync-schemas command with options', async () => {
      await component.runCommand('sync-schemas');
      expect(mockWailsService.runSyncSchemas).toHaveBeenCalledWith(jasmine.objectContaining({ force: false }));
    });

    it('should run load-column-templates command with options', async () => {
      await component.runCommand('load-column-templates');
      expect(mockWailsService.runLoadColumnTemplates).toHaveBeenCalledWith(jasmine.objectContaining({ clear: true }));
    });

    it('should run load-ontologies command with options', async () => {
      await component.runCommand('load-ontologies');
      expect(mockWailsService.runLoadOntologies).toHaveBeenCalledWith(jasmine.objectContaining({ noLimit: true }));
    });

    it('should set command to running', async () => {
      const promise = component.runCommand('sync-schemas');
      const cmd = component.commands().find(c => c.name === 'sync-schemas');
      expect(cmd?.running).toBeTrue();
      await promise;
    });

    it('should set command to not running after completion', async () => {
      await component.runCommand('sync-schemas');
      const cmd = component.commands().find(c => c.name === 'sync-schemas');
      expect(cmd?.running).toBeFalse();
    });

    it('should add output line on start', async () => {
      await component.runCommand('sync-schemas');
      const lines = component.outputLines();
      expect(lines.some(l => l.text.includes('sync-schemas'))).toBeTrue();
    });

    it('should add success output on completion', async () => {
      await component.runCommand('sync-schemas');
      const lines = component.outputLines();
      expect(lines.some(l => l.type === 'success')).toBeTrue();
    });

    it('should handle command error', async () => {
      mockWailsService.runSyncSchemas.and.rejectWith(new Error('Command failed'));
      await component.runCommand('sync-schemas');
      const lines = component.outputLines();
      expect(lines.some(l => l.type === 'error')).toBeTrue();
    });

    it('should refresh stats after command completion', async () => {
      await component.runCommand('sync-schemas');
      expect(mockWailsService.getSchemaCount).toHaveBeenCalled();
    });
  });

  describe('command output signal', () => {
    it('should add output from service', () => {
      fixture.detectChanges();
      commandOutputSignal.set({ command: 'test', output: 'Test output', type: 'info' });
      fixture.detectChanges();

      const lines = component.outputLines();
      expect(lines.some(l => l.text === 'Test output')).toBeTrue();
    });

    it('should handle error type output', () => {
      fixture.detectChanges();
      commandOutputSignal.set({ command: 'test', output: 'Error message', type: 'error' });
      fixture.detectChanges();

      const lines = component.outputLines();
      const errorLine = lines.find(l => l.text === 'Error message');
      expect(errorLine?.type).toBe('error');
    });
  });

  describe('backup functionality', () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await component.ngOnInit();
    });

    it('should load backups on init', async () => {
      expect(mockWailsService.listBackups).toHaveBeenCalled();
      expect(component.backups().length).toBe(2);
    });

    it('should run backup-database command', async () => {
      await component.runCommand('backup-database');
      expect(mockWailsService.createDatabaseBackup).toHaveBeenCalled();
    });

    it('should run backup-media command', async () => {
      await component.runCommand('backup-media');
      expect(mockWailsService.createMediaBackup).toHaveBeenCalled();
    });

    it('should run restore-database command', async () => {
      await component.runCommand('restore-database');
      expect(mockWailsService.restoreDatabase).toHaveBeenCalled();
    });

    it('should run restore-media command', async () => {
      await component.runCommand('restore-media');
      expect(mockWailsService.restoreMedia).toHaveBeenCalled();
    });

    it('should run import-initial-database command', async () => {
      await component.runCommand('import-initial-database');
      expect(mockWailsService.importInitialDatabase).toHaveBeenCalled();
    });

    it('should handle import-initial-database error', async () => {
      mockWailsService.importInitialDatabase.and.rejectWith(new Error('Import failed'));
      await component.runCommand('import-initial-database');
      const lines = component.outputLines();
      expect(lines.some(l => l.type === 'error')).toBeTrue();
    });

    it('should refresh stats after import-initial-database', async () => {
      mockWailsService.listBackups.calls.reset();
      await component.runCommand('import-initial-database');
      expect(mockWailsService.listBackups).toHaveBeenCalled();
    });

    it('should delete backup', async () => {
      const backup = mockBackups[0];
      await component.deleteBackup(backup);
      expect(mockWailsService.deleteBackup).toHaveBeenCalledWith(backup.path);
    });

    it('should open backup folder', async () => {
      await component.openBackupFolder();
      expect(mockWailsService.openBackupFolder).toHaveBeenCalled();
    });

    it('should format bytes correctly', () => {
      expect(component.formatBytes(0)).toBe('0 B');
      expect(component.formatBytes(1024)).toBe('1 KB');
      expect(component.formatBytes(1048576)).toBe('1 MB');
      expect(component.formatBytes(1073741824)).toBe('1 GB');
    });

    it('should update backup counts in commands', async () => {
      const dbBackupCmd = component.commands().find(c => c.name === 'backup-database');
      const mediaBackupCmd = component.commands().find(c => c.name === 'backup-media');
      expect(dbBackupCmd?.count).toBe(1);
      expect(mediaBackupCmd?.count).toBe(1);
    });

    it('should handle backup command error', async () => {
      mockWailsService.createDatabaseBackup.and.rejectWith(new Error('Backup failed'));
      await component.runCommand('backup-database');
      const lines = component.outputLines();
      expect(lines.some(l => l.type === 'error')).toBeTrue();
    });

    it('should handle delete backup error', async () => {
      mockWailsService.deleteBackup.and.rejectWith(new Error('Delete failed'));
      await component.deleteBackup(mockBackups[0]);
      const lines = component.outputLines();
      expect(lines.some(l => l.type === 'error' && l.text.includes('Failed to delete'))).toBeTrue();
    });

    it('should refresh stats after backup command', async () => {
      mockWailsService.listBackups.calls.reset();
      await component.runCommand('backup-database');
      expect(mockWailsService.listBackups).toHaveBeenCalled();
    });

    it('should refresh stats after delete backup', async () => {
      mockWailsService.listBackups.calls.reset();
      await component.deleteBackup(mockBackups[0]);
      expect(mockWailsService.listBackups).toHaveBeenCalled();
    });
  });
});
