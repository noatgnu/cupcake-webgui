import { Injectable, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  InstrumentJob,
  InstrumentJobService
} from '@noatgnu/cupcake-macaron';
import {
  Project,
  ProjectService
} from '@noatgnu/cupcake-red-velvet';
import {
  LabGroup,
  LabGroupService,
  User
} from '@noatgnu/cupcake-core';
import {
  MetadataTableTemplate,
  MetadataTableTemplateService
} from '@noatgnu/cupcake-vanilla';

@Injectable()
export class JobSubmissionStateService {
  jobId = signal<number | null>(null);
  existingJob = signal<InstrumentJob | null>(null);

  jobTitle = signal('');
  projectTitle = signal('');
  projectDescription = signal('');
  selectedProjectId = signal<number | null>(null);

  selectedLabGroupId = signal<number | null>(null);
  selectedStaffIds = signal<number[]>([]);
  labGroupSearchTerm = signal('');
  funder = signal('');
  funderSearchTerm = signal('');
  costCenter = signal('');
  costCenterSearchTerm = signal('');

  sampleNumber = signal<number>(1);

  selectedTemplateId = signal<number | null>(null);
  templateSource = signal<'user' | 'labgroup'>('user');

  metadataTableId = signal<number | null>(null);
  metadataTableCreated = signal(false);

  submitting = signal(false);
  loading = signal(false);

  projectSuggestions = signal<Project[]>([]);
  showProjectSuggestions = signal(false);
  searchingProjects = signal(false);

  labGroupSuggestions = signal<LabGroup[]>([]);
  showLabGroupSuggestions = signal(false);
  searchingLabGroups = signal(false);
  labGroupMembers = signal<User[]>([]);

  funderSuggestions = signal<string[]>([]);
  showFunderSuggestions = signal(false);

  costCenterSuggestions = signal<string[]>([]);
  showCostCenterSuggestions = signal(false);

  templates = signal<MetadataTableTemplate[]>([]);

  projectSearchSubject = new Subject<string>();
  labGroupSearchSubject = new Subject<string>();
  funderSearchSubject = new Subject<string>();
  costCenterSearchSubject = new Subject<string>();

  constructor(
    private instrumentJobService: InstrumentJobService,
    private projectService: ProjectService,
    private labGroupService: LabGroupService,
    private metadataTableTemplateService: MetadataTableTemplateService
  ) {
    this.setupSearchDebouncing();
  }

  private setupSearchDebouncing(): void {
    this.projectSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(search => this.searchProjects(search));

    this.labGroupSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(search => this.searchLabGroups(search));

    this.funderSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(search => this.searchFunders(search));

    this.costCenterSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(search => this.searchCostCenters(search));
  }

  searchProjects(search: string): void {
    if (!search || search.trim().length === 0) {
      this.projectSuggestions.set([]);
      return;
    }

    this.searchingProjects.set(true);
    this.projectService.getProjects({ search: search.trim(), limit: 10 }).subscribe({
      next: (response) => {
        this.projectSuggestions.set(response.results);
        this.searchingProjects.set(false);
      },
      error: (err) => {
        console.error('Error searching projects:', err);
        this.searchingProjects.set(false);
      }
    });
  }

  searchLabGroups(search: string): void {
    if (!search || search.trim().length === 0) {
      this.labGroupSuggestions.set([]);
      return;
    }

    this.searchingLabGroups.set(true);
    this.labGroupService.getLabGroups({ search: search.trim(), limit: 10 }).subscribe({
      next: (response) => {
        this.labGroupSuggestions.set(response.results);
        this.searchingLabGroups.set(false);
      },
      error: (err) => {
        console.error('Error searching lab groups:', err);
        this.searchingLabGroups.set(false);
      }
    });
  }

  searchFunders(search: string): void {
    if (!search || search.trim().length === 0) {
      this.funderSuggestions.set([]);
      return;
    }

    this.instrumentJobService.getInstrumentJobs({ limit: 10 }).subscribe({
      next: (response) => {
        const uniqueFunders = [...new Set(response.results.map(j => j.funder).filter(f => f && f.toLowerCase().includes(search.toLowerCase())))];
        this.funderSuggestions.set(uniqueFunders as string[]);
      },
      error: (err) => {
        console.error('Error searching funders:', err);
      }
    });
  }

  searchCostCenters(search: string): void {
    if (!search || search.trim().length === 0) {
      this.costCenterSuggestions.set([]);
      return;
    }

    this.instrumentJobService.getInstrumentJobs({ limit: 10 }).subscribe({
      next: (response) => {
        const uniqueCostCenters = [...new Set(response.results.map(j => j.costCenter).filter(c => c && c.toLowerCase().includes(search.toLowerCase())))];
        this.costCenterSuggestions.set(uniqueCostCenters as string[]);
      },
      error: (err) => {
        console.error('Error searching cost centers:', err);
      }
    });
  }

  loadLabGroupMembers(labGroupId: number): void {
    this.labGroupService.getLabGroupMembers(labGroupId, { directOnly: true, limit: 10 }).subscribe({
      next: (response) => {
        const members = response.results as unknown as User[];
        this.labGroupMembers.set(members);

        const memberIds = new Set(members.map(m => m.id));
        const currentStaffIds = this.selectedStaffIds();
        const validStaffIds = currentStaffIds.filter(id => memberIds.has(id));

        if (validStaffIds.length !== currentStaffIds.length) {
          this.selectedStaffIds.set(validStaffIds);
        }
      },
      error: (err) => {
        console.error('Error loading lab group members:', err);
      }
    });
  }

  loadLabGroupTemplates(labGroupId: number): void {
    this.metadataTableTemplateService.getMetadataTableTemplates({
      labGroupId: labGroupId,
      limit: 10
    }).subscribe({
      next: (response) => {
        this.templates.set(response.results);
      },
      error: (err) => {
        console.error('Error loading templates:', err);
      }
    });
  }

  loadUserTemplates(): void {
    this.metadataTableTemplateService.getMetadataTableTemplates({
      limit: 10
    }).subscribe({
      next: (response) => {
        this.templates.set(response.results);
      },
      error: (err) => {
        console.error('Error loading templates:', err);
      }
    });
  }

  selectProject(project: Project): void {
    this.selectedProjectId.set(project.id);
    this.projectTitle.set(project.projectName);
    this.projectDescription.set(project.projectDescription || '');
    this.showProjectSuggestions.set(false);
  }

  selectLabGroup(labGroup: LabGroup): void {
    this.selectedLabGroupId.set(labGroup.id);
    this.labGroupSearchTerm.set(labGroup.name);
    this.showLabGroupSuggestions.set(false);
    this.selectedStaffIds.set([]);
    this.loadLabGroupMembers(labGroup.id);
    this.loadLabGroupTemplates(labGroup.id);
  }

  clearLabGroupAndStaff(): void {
    this.selectedLabGroupId.set(null);
    this.labGroupSearchTerm.set('');
    this.selectedStaffIds.set([]);
    this.showLabGroupSuggestions.set(false);
    this.labGroupMembers.set([]);
  }

  toggleStaffSelection(userId: number): void {
    const current = this.selectedStaffIds();
    if (current.includes(userId)) {
      this.selectedStaffIds.set(current.filter(id => id !== userId));
    } else {
      this.selectedStaffIds.set([...current, userId]);
    }
  }

  reset(): void {
    this.jobId.set(null);
    this.existingJob.set(null);
    this.jobTitle.set('');
    this.projectTitle.set('');
    this.projectDescription.set('');
    this.selectedProjectId.set(null);
    this.selectedLabGroupId.set(null);
    this.selectedStaffIds.set([]);
    this.labGroupSearchTerm.set('');
    this.funder.set('');
    this.funderSearchTerm.set('');
    this.costCenter.set('');
    this.costCenterSearchTerm.set('');
    this.sampleNumber.set(1);
    this.selectedTemplateId.set(null);
    this.templateSource.set('user');
    this.metadataTableId.set(null);
    this.metadataTableCreated.set(false);
  }
}
