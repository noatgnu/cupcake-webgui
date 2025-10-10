import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProjectService, Project, ProjectCreateRequest, ProjectUpdateRequest } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-project-edit-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './project-edit-modal.html',
  styleUrl: './project-edit-modal.scss'
})
export class ProjectEditModal implements OnInit {
  activeModal = inject(NgbActiveModal);
  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);

  mode: 'create' | 'edit' = 'create';
  project: Project | null = null;

  projectName = signal('');
  projectDescription = signal('');
  saving = signal(false);

  ngOnInit(): void {
    if (this.mode === 'edit' && this.project) {
      this.projectName.set(this.project.projectName);
      this.projectDescription.set(this.project.projectDescription || '');
    }
  }

  save(): void {
    if (!this.projectName().trim()) {
      this.toastService.error('Project name is required');
      return;
    }

    this.saving.set(true);

    if (this.mode === 'create') {
      this.createProject();
    } else {
      this.updateProject();
    }
  }

  createProject(): void {
    const data: ProjectCreateRequest = {
      projectName: this.projectName(),
      projectDescription: this.projectDescription().trim() || undefined
    };

    this.projectService.createProject(data).subscribe({
      next: (project) => {
        this.activeModal.close(project);
      },
      error: (err) => {
        console.error('Error creating project:', err);
        this.toastService.error('Failed to create project');
        this.saving.set(false);
      }
    });
  }

  updateProject(): void {
    if (!this.project) return;

    const data: ProjectUpdateRequest = {
      projectName: this.projectName(),
      projectDescription: this.projectDescription().trim() || undefined
    };

    this.projectService.updateProject(this.project.id, data).subscribe({
      next: (project) => {
        this.activeModal.close(project);
      },
      error: (err) => {
        console.error('Error updating project:', err);
        this.toastService.error('Failed to update project');
        this.saving.set(false);
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
