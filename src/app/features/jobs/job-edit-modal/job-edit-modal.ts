import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { InstrumentJobService, InstrumentJob } from '@noatgnu/cupcake-macaron';
import { ToastService, ApiService, User } from '@noatgnu/cupcake-core';
import { Observable, of, OperatorFunction } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-job-edit-modal',
  imports: [CommonModule, FormsModule, NgbTypeaheadModule],
  templateUrl: './job-edit-modal.html',
  styleUrl: './job-edit-modal.scss',
})
export class JobEditModal implements OnInit {
  public activeModal = inject(NgbActiveModal);
  private instrumentJobService = inject(InstrumentJobService);
  private toastService = inject(ToastService);
  private apiService = inject(ApiService);

  job!: InstrumentJob;
  isStaffEdit = false;

  jobName = signal('');
  funder = signal('');
  costCenter = signal('');
  sampleNumber = signal(1);
  searchEngine = signal('');
  searchEngineVersion = signal('');
  method = signal('');
  location = signal('');
  selectedStaff = signal<User[]>([]);

  autocompleteData = signal<{
    funders: string[];
    cost_centers: string[];
    search_engines: { [key: string]: string[] };
  }>({
    funders: [],
    cost_centers: [],
    search_engines: {}
  });

  searchEngineVersions = computed(() => {
    const engine = this.searchEngine();
    const data = this.autocompleteData();
    return data.search_engines[engine] || [];
  });

  saving = signal(false);
  loadingAutocomplete = signal(false);
  loadingStaff = signal(false);

  Object = Object;

  ngOnInit(): void {
    if (this.job) {
      this.jobName.set(this.job.jobName || '');
      this.funder.set(this.job.funder || '');
      this.costCenter.set(this.job.costCenter || '');
      this.sampleNumber.set(this.job.sampleNumber || 1);
      this.searchEngine.set(this.job.searchEngine || '');
      this.searchEngineVersion.set(this.job.searchEngineVersion || '');
      this.method.set(this.job.method || '');
      this.location.set(this.job.location || '');

      this.loadStaff();
    }
    this.loadAutocompleteFields();
  }

  loadAutocompleteFields(): void {
    this.loadingAutocomplete.set(true);
    this.instrumentJobService.getAutocompleteFields().subscribe({
      next: (data: any) => {
        this.autocompleteData.set({
          funders: data.funders || [],
          cost_centers: data.cost_centers || [],
          search_engines: data.search_engines || {}
        });
        this.loadingAutocomplete.set(false);
      },
      error: (err) => {
        console.error('Error loading autocomplete fields:', err);
        this.loadingAutocomplete.set(false);
      }
    });
  }

  loadStaff(): void {
    if (!this.job.staff || this.job.staff.length === 0) {
      this.selectedStaff.set([]);
      return;
    }

    this.loadingStaff.set(true);
    const staffUsernames = this.job.staffUsernames || [];
    if (staffUsernames.length > 0) {
      const users: User[] = this.job.staff.map((id, index) => ({
        id,
        username: staffUsernames[index] || `User ${id}`,
        email: '',
        firstName: '',
        lastName: '',
        isStaff: false,
        isSuperuser: false,
        isActive: true,
        dateJoined: new Date().toISOString(),
        hasOrcid: false
      }));
      this.selectedStaff.set(users);
      this.loadingStaff.set(false);
    } else {
      this.selectedStaff.set([]);
      this.loadingStaff.set(false);
    }
  }

  searchUsers: OperatorFunction<string, readonly User[]> = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.length < 2) {
          return of([]);
        }
        return this.apiService.getUsers({ search: term, limit: 10 }).pipe(
          map((response) => response.results),
          catchError(() => of([]))
        );
      })
    );

  userFormatter = (user: User) => user.username;

  userInputFormatter = (user: User) => user.username;

  onStaffSelected(event: any): void {
    const user = event.item as User;
    const currentStaff = this.selectedStaff();
    if (!currentStaff.find(s => s.id === user.id)) {
      this.selectedStaff.set([...currentStaff, user]);
    }
    setTimeout(() => {
      (event.target as HTMLInputElement).value = '';
    });
  }

  removeStaff(user: User): void {
    this.selectedStaff.set(this.selectedStaff().filter(s => s.id !== user.id));
  }

  save(): void {
    if (!this.job || !this.job.id) {
      this.toastService.error('Invalid job');
      return;
    }

    const updateData: any = {};

    if (this.jobName().trim() !== this.job.jobName) {
      updateData.jobName = this.jobName().trim();
    }

    if (this.funder().trim() !== (this.job.funder || '')) {
      updateData.funder = this.funder().trim() || undefined;
    }

    if (this.costCenter().trim() !== (this.job.costCenter || '')) {
      updateData.costCenter = this.costCenter().trim() || undefined;
    }

    if (this.sampleNumber() !== (this.job.sampleNumber || 1)) {
      updateData.sampleNumber = this.sampleNumber();
    }

    if (this.searchEngine().trim() !== (this.job.searchEngine || '')) {
      updateData.searchEngine = this.searchEngine().trim() || undefined;
    }

    if (this.searchEngineVersion().trim() !== (this.job.searchEngineVersion || '')) {
      updateData.searchEngineVersion = this.searchEngineVersion().trim() || undefined;
    }

    if (this.method().trim() !== (this.job.method || '')) {
      updateData.method = this.method().trim() || undefined;
    }

    if (this.location().trim() !== (this.job.location || '')) {
      updateData.location = this.location().trim() || undefined;
    }

    const newStaffIds = this.selectedStaff().map(s => s.id).sort();
    const oldStaffIds = (this.job.staff || []).sort();
    const staffChanged = JSON.stringify(newStaffIds) !== JSON.stringify(oldStaffIds);

    if (staffChanged) {
      updateData.staff = newStaffIds.length > 0 ? newStaffIds : undefined;
    }

    if (Object.keys(updateData).length === 0) {
      this.toastService.info('No changes to save');
      return;
    }

    this.saving.set(true);
    this.instrumentJobService.patchInstrumentJob(this.job.id, updateData).subscribe({
      next: (updatedJob) => {
        this.toastService.success('Job details updated successfully');
        this.activeModal.close(updatedJob);
      },
      error: (err) => {
        console.error('Error updating job:', err);
        this.toastService.error('Failed to update job details');
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
