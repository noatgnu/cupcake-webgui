import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WailsService, SyncSchemasOptions, LoadColumnTemplatesOptions, LoadOntologiesOptions, BackupInfo } from '../../core/services/wails.service';

interface CommandOption {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'select';
  value: boolean | number | string[];
  description: string;
  choices?: { value: string; label: string }[];
}

interface CommandStatus {
  name: string;
  displayName: string;
  description: string;
  running: boolean;
  success: boolean | null;
  count: number | null;
  icon: string;
  expanded: boolean;
  options: CommandOption[];
}

@Component({
  selector: 'app-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './management.component.html',
  styleUrl: './management.component.scss'
})
export class ManagementComponent implements OnInit, OnDestroy {
  @ViewChild('terminalViewport') private terminalViewport!: ElementRef;
  private wails = inject(WailsService);
  private lastOutputTime = 0;

  constructor() {
    effect(() => {
      const output = this.wails.commandOutput();
      if (output && Date.now() - this.lastOutputTime > 100) {
        this.lastOutputTime = Date.now();
        const type = output.type === 'error' ? 'error' : 'info';
        this.addOutput(output.output, type);
      }
    });
  }

  ontologyTypes = [
    { value: 'psims', label: 'PSIMS' },
    { value: 'cell', label: 'Cell Ontology' },
    { value: 'mondo', label: 'MONDO Disease' },
    { value: 'uberon', label: 'UBERON Anatomy' },
    { value: 'species', label: 'Species' },
    { value: 'unimod', label: 'Unimod' },
    { value: 'tissue', label: 'Tissue' },
    { value: 'msVocab', label: 'MS Vocabularies' },
    { value: 'humanDisease', label: 'Human Disease' },
    { value: 'subcellularLoc', label: 'Subcellular Location' },
    { value: 'ncbi', label: 'NCBI Taxonomy' },
    { value: 'chebi', label: 'ChEBI Compound' }
  ];

  commands = signal<CommandStatus[]>([
    {
      name: 'sync-schemas',
      displayName: 'SDRF Schema Synchronization',
      description: 'Fetch official metadata schemas from centralized repositories',
      running: false,
      success: null,
      count: null,
      icon: 'bi bi-arrow-repeat',
      expanded: false,
      options: [
        { key: 'force', label: 'Force Re-download', type: 'boolean', value: false, description: 'Force re-download of schema files (schemas update by default)' }
      ]
    },
    {
      name: 'load-column-templates',
      displayName: 'Column Template Provisioning',
      description: 'Import standardized column definitions into local storage',
      running: false,
      success: null,
      count: null,
      icon: 'bi bi-file-earmark-text',
      expanded: false,
      options: [
        { key: 'clear', label: 'Clear Existing', type: 'boolean', value: true, description: 'Remove existing templates before importing (prevents duplicates)' }
      ]
    },
    {
      name: 'load-ontologies',
      displayName: 'Ontology Initialization',
      description: 'Import all ontology terminologies (OBO, UniProt, Unimod)',
      running: false,
      success: null,
      count: null,
      icon: 'bi bi-diagram-3',
      expanded: false,
      options: [
        { key: 'noLimit', label: 'Load All Terms', type: 'boolean', value: true, description: 'Load all ontology terms without limit' },
        { key: 'limit', label: 'Term Limit', type: 'number', value: 1000, description: 'Maximum number of terms to load (when not loading all)' },
        { key: 'types', label: 'Ontology Types', type: 'select', value: [], description: 'Specific ontology types to load (empty = all)' }
      ]
    },
    {
      name: 'backup-database',
      displayName: 'Database Backup',
      description: 'Create a backup of the SQLite database',
      running: false,
      success: null,
      count: null,
      icon: 'bi bi-database-down',
      expanded: false,
      options: []
    },
    {
      name: 'backup-media',
      displayName: 'Media Backup',
      description: 'Create a backup of uploaded media files',
      running: false,
      success: null,
      count: null,
      icon: 'bi bi-file-earmark-zip',
      expanded: false,
      options: []
    },
    {
      name: 'restore-database',
      displayName: 'Restore Database',
      description: 'Restore the database from the latest backup',
      running: false,
      success: null,
      count: null,
      icon: 'bi bi-database-up',
      expanded: false,
      options: []
    },
    {
      name: 'restore-media',
      displayName: 'Restore Media',
      description: 'Restore media files from the latest backup',
      running: false,
      success: null,
      count: null,
      icon: 'bi bi-file-earmark-arrow-up',
      expanded: false,
      options: []
    },
    {
      name: 'import-initial-database',
      displayName: 'Import Pre-built Database',
      description: 'Replace the current database with a pre-populated SQLite file',
      running: false,
      success: null,
      count: null,
      icon: 'bi bi-database-add',
      expanded: false,
      options: []
    }
  ]);

  backups = signal<BackupInfo[]>([]);

  schemaCount = signal(0);
  columnTemplateCount = signal(0);
  ontologyCounts = signal<Record<string, number>>({});

  ontologyTotal = computed(() => this.ontologyCounts()['total'] || 0);

  ontologyBreakdown = computed(() => {
    const counts = this.ontologyCounts();
    const labels: Record<string, string> = {
      psims: 'PSIMS',
      cell: 'Cell',
      mondo: 'MONDO',
      uberon: 'UBERON',
      species: 'Species',
      unimod: 'Unimod',
      tissue: 'Tissue',
      msVocab: 'MS Vocab',
      humanDisease: 'Human Disease',
      subcellularLoc: 'Subcellular',
      ncbi: 'NCBI',
      chebi: 'ChEBI'
    };
    return Object.keys(labels)
      .map(key => ({
        name: labels[key],
        count: counts[key] || 0
      }))
      .filter(item => item.count > 0);
  });

  outputLines = signal<{text: string; type: string}[]>([]);

  async ngOnInit(): Promise<void> {
    await this.refreshStats();
  }

  ngOnDestroy(): void {}

  async refreshStats(): Promise<void> {
    try {
      const [schemas, templates, ontologies, backupList] = await Promise.all([
        this.wails.getSchemaCount(),
        this.wails.getColumnTemplateCount(),
        this.wails.getOntologyCounts(),
        this.wails.listBackups()
      ]);

      this.schemaCount.set(schemas);
      this.columnTemplateCount.set(templates);
      this.ontologyCounts.set(ontologies);
      this.backups.set(backupList);

      this.updateCommandCount('sync-schemas', schemas);
      this.updateCommandCount('load-column-templates', templates);
      this.updateCommandCount('load-ontologies', ontologies['total'] || 0);

      const dbBackups = backupList.filter(b => b.type === 'database').length;
      const mediaBackups = backupList.filter(b => b.type === 'media').length;
      this.updateCommandCount('backup-database', dbBackups);
      this.updateCommandCount('backup-media', mediaBackups);
      this.updateCommandCount('restore-database', dbBackups);
      this.updateCommandCount('restore-media', mediaBackups);
    } catch (error) {
      this.wails.logToFile(`Stat refresh failure: ${error}`);
    }
  }

  private updateCommandCount(name: string, count: number): void {
    this.commands.update(cmds =>
      cmds.map(cmd => cmd.name === name ? { ...cmd, count } : cmd)
    );
  }

  toggleExpanded(name: string): void {
    this.commands.update(cmds =>
      cmds.map(cmd => cmd.name === name ? { ...cmd, expanded: !cmd.expanded } : cmd)
    );
  }

  getOptionValue(cmdName: string, optionKey: string): boolean | number | string[] {
    const cmd = this.commands().find(c => c.name === cmdName);
    const option = cmd?.options.find(o => o.key === optionKey);
    return option?.value ?? false;
  }

  setOptionValue(cmdName: string, optionKey: string, value: boolean | number | string[]): void {
    this.commands.update(cmds =>
      cmds.map(cmd => {
        if (cmd.name !== cmdName) return cmd;
        return {
          ...cmd,
          options: cmd.options.map(opt =>
            opt.key === optionKey ? { ...opt, value } : opt
          )
        };
      })
    );
  }

  toggleOntologyType(type: string): void {
    const currentTypes = this.getOptionValue('load-ontologies', 'types') as string[];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    this.setOptionValue('load-ontologies', 'types', newTypes);
  }

  isOntologyTypeSelected(type: string): boolean {
    const types = this.getOptionValue('load-ontologies', 'types') as string[];
    return types.includes(type);
  }

  async runCommand(name: string): Promise<void> {
    this.setCommandStatus(name, true);
    this.addOutput(`Initiating ${name} process...`, 'info');

    const cmd = this.commands().find(c => c.name === name);
    const options = cmd?.options.reduce((acc, opt) => ({ ...acc, [opt.key]: opt.value }), {}) ?? {};

    try {
      switch (name) {
        case 'sync-schemas':
          await this.wails.runSyncSchemas(options as SyncSchemasOptions);
          break;
        case 'load-column-templates':
          await this.wails.runLoadColumnTemplates(options as LoadColumnTemplatesOptions);
          break;
        case 'load-ontologies':
          await this.wails.runLoadAllOntologies(options as LoadOntologiesOptions);
          break;
        case 'backup-database':
          await this.wails.createDatabaseBackup();
          break;
        case 'backup-media':
          await this.wails.createMediaBackup();
          break;
        case 'restore-database':
          await this.wails.restoreDatabase();
          break;
        case 'restore-media':
          await this.wails.restoreMedia();
          break;
        case 'import-initial-database':
          await this.wails.importInitialDatabase();
          break;
      }

      this.setCommandStatus(name, false, true);
      this.addOutput('Process completed successfully.', 'success');
      await this.refreshStats();
    } catch (error) {
      this.setCommandStatus(name, false, false);
      this.addOutput(`Process failed: ${error}`, 'error');
    }
  }

  async deleteBackup(backup: BackupInfo): Promise<void> {
    this.addOutput(`Deleting backup: ${backup.name}...`, 'info');
    try {
      await this.wails.deleteBackup(backup.path);
      this.addOutput(`Backup deleted: ${backup.name}`, 'success');
      await this.refreshStats();
    } catch (error) {
      this.addOutput(`Failed to delete backup: ${error}`, 'error');
    }
  }

  async openBackupFolder(): Promise<void> {
    await this.wails.openBackupFolder();
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private setCommandStatus(name: string, running: boolean, success: boolean | null = null): void {
    this.commands.update(cmds =>
      cmds.map(cmd => cmd.name === name ? { ...cmd, running, success: success ?? cmd.success } : cmd)
    );
  }

  private addOutput(text: string, type: string): void {
    this.outputLines.update(lines => [...lines, { text, type }]);
    setTimeout(() => this.scrollToBottom(), 10);
  }

  private scrollToBottom(): void {
    if (this.terminalViewport) {
      const el = this.terminalViewport.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
