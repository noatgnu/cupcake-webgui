import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProjectService, Project } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { ProjectEditModal } from '../project-edit-modal/project-edit-modal';
import { ProjectDetail } from '../project-detail/project-detail';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule, NgbPaginationModule, ProjectDetail],
  templateUrl: './projects.html',
  styleUrl: './projects.scss'
})
export class Projects implements OnInit {
  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);
  private modalService = inject(NgbModal);

  projects = signal<Project[]>([]);
  selectedProject = signal<Project | null>(null);
  loading = signal(false);
  searchTerm = '';

  currentPage = signal(1);
  pageSize = 10;
  totalCount = signal(0);
  Math = Math;

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(page: number = 1): void {
    this.loading.set(true);
    const params: any = {
      limit: this.pageSize,
      offset: (page - 1) * this.pageSize
    };

    if (this.searchTerm.trim().length > 0) {
      params.search = this.searchTerm;
    }

    this.projectService.getProjects(params).subscribe({
      next: (response) => {
        this.projects.set(response.results);
        this.totalCount.set(response.count);
        this.currentPage.set(page);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading projects:', err);
        this.toastService.error('Failed to load projects');
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.loadProjects(1);
  }

  goToPage(page: number): void {
    this.loadProjects(page);
  }

  selectProject(project: Project): void {
    this.selectedProject.set(project);
  }

  deselectProject(): void {
    this.selectedProject.set(null);
  }

  createProject(): void {
    const modalRef = this.modalService.open(ProjectEditModal, { size: 'lg' });
    modalRef.componentInstance.mode = 'create';
    modalRef.result.then(
      (result) => {
        if (result) {
          this.toastService.success('Project created successfully');
          this.loadProjects(this.currentPage());
        }
      },
      () => {}
    );
  }

  editProject(): void {
    const project = this.selectedProject();
    if (!project) return;

    const modalRef = this.modalService.open(ProjectEditModal, { size: 'lg' });
    modalRef.componentInstance.mode = 'edit';
    modalRef.componentInstance.project = project;
    modalRef.result.then(
      (result) => {
        if (result) {
          this.toastService.success('Project updated successfully');
          this.loadProjects(this.currentPage());
          this.selectedProject.set(result);
        }
      },
      () => {}
    );
  }
}
