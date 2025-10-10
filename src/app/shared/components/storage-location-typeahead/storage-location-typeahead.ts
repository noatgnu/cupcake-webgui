import { Component, inject, Input, Output, EventEmitter, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService, StorageObject, StoragePathUtils } from '@noatgnu/cupcake-macaron';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-storage-location-typeahead',
  imports: [CommonModule, FormsModule],
  templateUrl: './storage-location-typeahead.html',
  styleUrl: './storage-location-typeahead.scss'
})
export class StorageLocationTypeahead implements OnDestroy {
  private storageService = inject(StorageService);

  @Input() placeholder: string = 'Search for location...';
  @Input() selectedLocationId?: number;
  @Input() selectedLocationName?: string;
  @Output() locationSelected = new EventEmitter<StorageObject | null>();

  searchTerm = signal('');
  results = signal<StorageObject[]>([]);
  loading = signal(false);
  showDropdown = signal(false);

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  constructor() {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term || term.length < 2) {
          this.results.set([]);
          this.showDropdown.set(false);
          return [];
        }
        this.loading.set(true);
        return this.storageService.searchStorageObjects(term);
      })
    ).subscribe({
      next: (response) => {
        this.results.set(response.results || []);
        this.showDropdown.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error searching storage objects:', err);
        this.results.set([]);
        this.loading.set(false);
      }
    });

    if (this.selectedLocationId && this.selectedLocationName) {
      this.searchTerm.set(this.selectedLocationName);
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.searchSubject.next(value);
  }

  selectLocation(location: StorageObject): void {
    this.searchTerm.set(location.objectName);
    this.showDropdown.set(false);
    this.locationSelected.emit(location);
  }

  clearSelection(): void {
    this.searchTerm.set('');
    this.results.set([]);
    this.showDropdown.set(false);
    this.locationSelected.emit(null);
  }

  getPathString(location: StorageObject): string {
    if (!location.fullPath || location.fullPath.length === 0) {
      return location.objectName;
    }
    return StoragePathUtils.pathToString(location.fullPath, ' > ');
  }

  closeDropdown(): void {
    setTimeout(() => {
      this.showDropdown.set(false);
    }, 200);
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }
}
