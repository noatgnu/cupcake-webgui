import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { MaintenanceService, MaintenanceType, Status, MaintenanceTypeLabels, StatusLabels } from '@noatgnu/cupcake-macaron';
import type { MaintenanceLog } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-maintenance-log-edit-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './maintenance-log-edit-modal.html',
  styleUrl: './maintenance-log-edit-modal.scss'
})
export class MaintenanceLogEditModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private maintenanceService = inject(MaintenanceService);
  private toastService = inject(ToastService);

  @Input() maintenanceLog?: MaintenanceLog;
  @Input() instrumentId?: number;

  saving = signal(false);
  isEdit = false;

  MaintenanceType = MaintenanceType;
  maintenanceTypeLabels = MaintenanceTypeLabels;
  maintenanceTypes = Object.values(MaintenanceType);

  Status = Status;
  statusLabels = StatusLabels;
  statuses = Object.values(Status);

  maintenanceDate = '';
  maintenanceType: MaintenanceType = MaintenanceType.ROUTINE;
  status: Status = Status.PENDING;
  maintenanceDescription = '';
  maintenanceNotes = '';
  isTemplate = false;

  templates = signal<MaintenanceLog[]>([]);
  filteredTemplates = signal<MaintenanceLog[]>([]);
  loadingTemplates = signal(false);
  templateSearch = '';
  showTemplateSelector = signal(true);

  ngOnInit(): void {
    if (this.maintenanceLog) {
      this.isEdit = true;
      this.maintenanceDate = this.maintenanceLog.maintenanceDate ? this.maintenanceLog.maintenanceDate.split('T')[0] : '';
      this.maintenanceType = this.maintenanceLog.maintenanceType;
      this.status = this.maintenanceLog.status;
      this.maintenanceDescription = this.maintenanceLog.maintenanceDescription || '';
      this.maintenanceNotes = this.maintenanceLog.maintenanceNotes || '';
      this.isTemplate = this.maintenanceLog.isTemplate;
      this.showTemplateSelector.set(false);
    } else {
      const now = new Date();
      this.maintenanceDate = now.toISOString().split('T')[0];
      this.loadTemplates();
    }
  }

  loadTemplates(): void {
    this.loadingTemplates.set(true);
    this.maintenanceService.getMaintenanceTemplates().subscribe({
      next: (response) => {
        this.templates.set(response.results);
        this.filteredTemplates.set(response.results);
        this.loadingTemplates.set(false);
      },
      error: (err) => {
        console.error('Error loading templates:', err);
        this.loadingTemplates.set(false);
      }
    });
  }

  onTemplateSearchChange(): void {
    const search = this.templateSearch.toLowerCase().trim();
    if (!search) {
      this.filteredTemplates.set(this.templates());
    } else {
      const filtered = this.templates().filter(template =>
        template.maintenanceDescription?.toLowerCase().includes(search) ||
        template.maintenanceNotes?.toLowerCase().includes(search) ||
        template.maintenanceTypeDisplay?.toLowerCase().includes(search)
      );
      this.filteredTemplates.set(filtered);
    }
  }

  applyTemplate(template: MaintenanceLog): void {
    this.maintenanceType = template.maintenanceType;
    this.maintenanceDescription = template.maintenanceDescription || '';
    this.maintenanceNotes = template.maintenanceNotes || '';
    this.showTemplateSelector.set(false);
    this.toastService.success('Template applied successfully');
  }

  clearTemplate(): void {
    this.maintenanceType = MaintenanceType.ROUTINE;
    this.maintenanceDescription = '';
    this.maintenanceNotes = '';
    this.showTemplateSelector.set(true);
    this.templateSearch = '';
    this.onTemplateSearchChange();
  }

  save(): void {
    if (!this.maintenanceDate) {
      this.toastService.error('Maintenance date is required');
      return;
    }

    if (!this.isEdit && !this.instrumentId) {
      this.toastService.error('Instrument ID is required');
      return;
    }

    this.saving.set(true);

    if (this.isEdit && this.maintenanceLog) {
      const updatePayload = {
        maintenanceDate: this.maintenanceDate,
        maintenanceType: this.maintenanceType,
        status: this.status,
        maintenanceDescription: this.maintenanceDescription.trim() || undefined,
        maintenanceNotes: this.maintenanceNotes.trim() || undefined,
        isTemplate: this.isTemplate
      };

      this.maintenanceService.updateMaintenanceLog(this.maintenanceLog.id, updatePayload).subscribe({
        next: (updated) => {
          this.toastService.success('Maintenance log updated successfully');
          this.activeModal.close(updated);
        },
        error: (err) => {
          this.toastService.error('Failed to update maintenance log');
          console.error('Error updating maintenance log:', err);
          this.saving.set(false);
        }
      });
    } else {
      const createPayload = {
        instrument: this.instrumentId!,
        maintenanceDate: this.maintenanceDate,
        maintenanceType: this.maintenanceType,
        maintenanceDescription: this.maintenanceDescription.trim() || undefined,
        maintenanceNotes: this.maintenanceNotes.trim() || undefined,
        isTemplate: this.isTemplate
      };

      this.maintenanceService.createMaintenanceLog(createPayload).subscribe({
        next: (created) => {
          this.toastService.success('Maintenance log created successfully');
          this.activeModal.close(created);
        },
        error: (err) => {
          this.toastService.error('Failed to create maintenance log');
          console.error('Error creating maintenance log:', err);
          this.saving.set(false);
        }
      });
    }
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
