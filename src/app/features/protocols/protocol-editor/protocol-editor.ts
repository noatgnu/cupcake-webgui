import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '@noatgnu/cupcake-core';
import { ProtocolService, ProtocolSectionService, ProtocolStepService, StepReagentService } from '@noatgnu/cupcake-red-velvet';
import type { ProtocolModel, ProtocolSection, ProtocolStep, StepReagent } from '@noatgnu/cupcake-red-velvet';
import { DurationInput } from '../../../shared/components/duration-input/duration-input';
import { DurationFormatPipe } from '../../../shared/pipes/duration-format-pipe';
import { StepTemplatePipe } from '../../../shared/pipes/step-template-pipe';
import { StepCreateModal } from '../step-create-modal/step-create-modal';
import { StepEditModal } from '../step-edit-modal/step-edit-modal';
import { StepReagentModal } from '../step-reagent-modal/step-reagent-modal';
import { SessionCreateModal } from '../session-create-modal/session-create-modal';

@Component({
  selector: 'app-protocol-editor',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DurationInput,
    DurationFormatPipe,
    StepTemplatePipe,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu
  ],
  templateUrl: './protocol-editor.html',
  styleUrl: './protocol-editor.scss'
})
export class ProtocolEditor implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private protocolService = inject(ProtocolService);
  private sectionService = inject(ProtocolSectionService);
  private stepService = inject(ProtocolStepService);
  private stepReagentService = inject(StepReagentService);
  private toastService = inject(ToastService);
  private modalService = inject(NgbModal);

  protocol = signal<ProtocolModel | null>(null);
  sections = signal<ProtocolSection[]>([]);
  selectedSectionIndex = signal(0);
  steps = signal<Map<number, ProtocolStep[]>>(new Map());
  stepReagents = signal<Map<number, StepReagent[]>>(new Map());

  loading = signal(false);
  saving = signal(false);

  protocolForm: FormGroup = this.fb.group({
    protocolTitle: ['', Validators.required],
    protocolDescription: [''],
    enabled: [false]
  });

  sectionForm: FormGroup = this.fb.group({
    sectionDescription: [''],
    sectionDuration: [0]
  });

  selectedSection = computed(() => {
    const index = this.selectedSectionIndex();
    const sectionsList = this.sections();
    return index >= 0 && index < sectionsList.length ? sectionsList[index] : null;
  });

  selectedSectionSteps = computed(() => {
    const section = this.selectedSection();
    if (!section) return [];
    return this.steps().get(section.id) || [];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.toastService.error('Invalid protocol ID');
      this.router.navigate(['/protocols']);
      return;
    }

    this.loadProtocol(parseInt(id, 10));
  }

  loadProtocol(id: number): void {
    this.loading.set(true);
    this.protocolService.getProtocol(id).subscribe({
      next: (protocol) => {
        this.protocol.set(protocol);
        this.protocolForm.patchValue({
          protocolTitle: protocol.protocolTitle,
          protocolDescription: protocol.protocolDescription,
          enabled: protocol.enabled
        });
        this.loadSections(id);
      },
      error: (err) => {
        this.toastService.error('Failed to load protocol');
        console.error('Error loading protocol:', err);
        this.router.navigate(['/protocols']);
      }
    });
  }

  loadSections(protocolId: number): void {
    this.sectionService.getProtocolSections({ protocol: protocolId, ordering: 'order' }).subscribe({
      next: (response) => {
        this.sections.set(response.results);
        if (response.results.length > 0) {
          this.selectSection(0);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to load sections');
        console.error('Error loading sections:', err);
        this.loading.set(false);
      }
    });
  }

  loadStepsForSection(sectionId: number): void {
    this.stepService.getProtocolSteps({
      stepSection: sectionId,
      ordering: 'order'
    }).subscribe({
      next: (response) => {
        const stepsMap = new Map(this.steps());
        stepsMap.set(sectionId, response.results);
        this.steps.set(stepsMap);

        response.results.forEach(step => {
          this.loadStepReagents(step.id);
        });
      },
      error: (err) => {
        this.toastService.error('Failed to load steps');
        console.error('Error loading steps:', err);
      }
    });
  }

  selectSection(index: number): void {
    this.selectedSectionIndex.set(index);
    const section = this.sections()[index];

    if (section) {
      this.sectionForm.patchValue({
        sectionDescription: section.sectionDescription,
        sectionDuration: section.sectionDuration
      });

      this.loadStepsForSection(section.id);
    }
  }

  saveProtocol(): void {
    if (!this.protocolForm.valid) {
      this.toastService.error('Please fill in required fields');
      return;
    }

    this.saving.set(true);
    const formValue = this.protocolForm.value;
    const protocolId = this.protocol()?.id;

    if (!protocolId) return;

    this.protocolService.updateProtocol(protocolId, {
      protocolTitle: formValue.protocolTitle,
      protocolDescription: formValue.protocolDescription,
      enabled: formValue.enabled
    }).subscribe({
      next: (updated) => {
        this.toastService.success('Protocol saved successfully');
        this.protocol.set(updated);
        this.saving.set(false);
      },
      error: (err) => {
        this.toastService.error('Failed to save protocol');
        console.error('Error saving protocol:', err);
        this.saving.set(false);
      }
    });
  }

  createSection(): void {
    const protocolId = this.protocol()?.id;
    if (!protocolId) {
      this.toastService.error('Please save the protocol first');
      return;
    }

    const sectionCount = this.sections().length;
    this.sectionService.createProtocolSection({
      protocol: protocolId,
      sectionDescription: `New Section ${sectionCount + 1}`,
      sectionDuration: 0,
      order: sectionCount
    }).subscribe({
      next: (section) => {
        this.toastService.success('Section created');
        const updatedSections = [...this.sections(), section];
        this.sections.set(updatedSections);
        this.selectSection(updatedSections.length - 1);
      },
      error: (err) => {
        this.toastService.error('Failed to create section');
        console.error('Error creating section:', err);
      }
    });
  }

  saveSection(): void {
    const section = this.selectedSection();
    if (!section) return;

    const formValue = this.sectionForm.value;
    this.sectionService.patchProtocolSection(section.id, {
      sectionDescription: formValue.sectionDescription,
      sectionDuration: formValue.sectionDuration
    }).subscribe({
      next: (updated) => {
        this.toastService.success('Section saved');
        const updatedSections = this.sections().map(s =>
          s.id === section.id ? updated : s
        );
        this.sections.set(updatedSections);
      },
      error: (err) => {
        this.toastService.error('Failed to save section');
        console.error('Error saving section:', err);
      }
    });
  }

  deleteSection(): void {
    const section = this.selectedSection();
    if (!section) return;

    if (!confirm(`Are you sure you want to delete section "${section.sectionDescription}"?`)) {
      return;
    }

    this.sectionService.deleteProtocolSection(section.id).subscribe({
      next: () => {
        this.toastService.success('Section deleted');
        const updatedSections = this.sections().filter(s => s.id !== section.id);
        this.sections.set(updatedSections);

        const stepsMap = new Map(this.steps());
        stepsMap.delete(section.id);
        this.steps.set(stepsMap);

        if (updatedSections.length > 0) {
          this.selectSection(Math.max(0, this.selectedSectionIndex() - 1));
        }
      },
      error: (err) => {
        this.toastService.error('Failed to delete section');
        console.error('Error deleting section:', err);
      }
    });
  }

  addStep(): void {
    const section = this.selectedSection();
    if (!section) {
      this.toastService.error('Please select a section first');
      return;
    }

    const protocolId = this.protocol()?.id;
    if (!protocolId) return;

    const currentSteps = this.selectedSectionSteps();
    const modalRef = this.modalService.open(StepCreateModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.protocolId = protocolId;
    modalRef.componentInstance.sectionId = section.id;
    modalRef.componentInstance.order = currentSteps.length;

    modalRef.result.then(
      (step: ProtocolStep) => {
        const stepsMap = new Map(this.steps());
        const updatedSteps = [...currentSteps, step];
        stepsMap.set(section.id, updatedSteps);
        this.steps.set(stepsMap);
      },
      () => {}
    );
  }

  editStep(step: ProtocolStep): void {
    const modalRef = this.modalService.open(StepEditModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.step = step;

    modalRef.result.then(
      (updatedStep: ProtocolStep) => {
        const section = this.selectedSection();
        if (section) {
          const stepsMap = new Map(this.steps());
          const currentSteps = stepsMap.get(section.id) || [];
          const updatedSteps = currentSteps.map(s => s.id === updatedStep.id ? updatedStep : s);
          stepsMap.set(section.id, updatedSteps);
          this.steps.set(stepsMap);
        }
      },
      () => {}
    );
  }

  moveStepUp(step: ProtocolStep, index: number): void {
    if (index === 0) return;

    const section = this.selectedSection();
    if (!section) return;

    const currentSteps = this.selectedSectionSteps();
    const previousStep = currentSteps[index - 1];

    this.swapStepOrder(step, previousStep, section.id);
  }

  moveStepDown(step: ProtocolStep, index: number): void {
    const currentSteps = this.selectedSectionSteps();
    if (index === currentSteps.length - 1) return;

    const section = this.selectedSection();
    if (!section) return;

    const nextStep = currentSteps[index + 1];

    this.swapStepOrder(step, nextStep, section.id);
  }

  private swapStepOrder(step1: ProtocolStep, step2: ProtocolStep, sectionId: number): void {
    const temp = step1.order;

    this.stepService.patchProtocolStep(step1.id, { order: step2.order }).subscribe({
      next: () => {
        this.stepService.patchProtocolStep(step2.id, { order: temp }).subscribe({
          next: () => {
            this.toastService.success('Step order updated');
            this.loadStepsForSection(sectionId);
          },
          error: (err) => {
            this.toastService.error('Failed to update step order');
            console.error('Error updating step order:', err);
          }
        });
      },
      error: (err) => {
        this.toastService.error('Failed to update step order');
        console.error('Error updating step order:', err);
      }
    });
  }

  deleteStep(stepId: number): void {
    if (!confirm('Are you sure you want to delete this step?')) {
      return;
    }

    this.stepService.deleteProtocolStep(stepId).subscribe({
      next: () => {
        this.toastService.success('Step deleted');
        const section = this.selectedSection();
        if (section) {
          const stepsMap = new Map(this.steps());
          const updatedSteps = (stepsMap.get(section.id) || []).filter(s => s.id !== stepId);
          stepsMap.set(section.id, updatedSteps);
          this.steps.set(stepsMap);
        }
      },
      error: (err) => {
        this.toastService.error('Failed to delete step');
        console.error('Error deleting step:', err);
      }
    });
  }

  backToList(): void {
    this.router.navigate(['/protocols']);
  }

  loadStepReagents(stepId: number): void {
    this.stepReagentService.getReagentsByStep(stepId).subscribe({
      next: (response) => {
        const reagentsMap = new Map(this.stepReagents());
        reagentsMap.set(stepId, response.results);
        this.stepReagents.set(reagentsMap);
      },
      error: (err) => {
        this.toastService.error('Failed to load step reagents');
        console.error('Error loading step reagents:', err);
      }
    });
  }

  getStepReagents(stepId: number): StepReagent[] {
    return this.stepReagents().get(stepId) || [];
  }

  addStepReagent(step: ProtocolStep): void {
    const modalRef = this.modalService.open(StepReagentModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.stepId = step.id;

    modalRef.result.then(
      (reagent: StepReagent) => {
        this.loadStepReagents(step.id);
        this.toastService.success('Reagent added to step');
      },
      () => {}
    );
  }

  editStepReagent(stepId: number, reagent: StepReagent): void {
    const modalRef = this.modalService.open(StepReagentModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.stepId = stepId;
    modalRef.componentInstance.stepReagent = reagent;

    modalRef.result.then(
      (updatedReagent: StepReagent) => {
        this.loadStepReagents(stepId);
        this.toastService.success('Reagent updated');
      },
      () => {}
    );
  }

  deleteStepReagent(stepId: number, reagentId: number): void {
    if (!confirm('Are you sure you want to remove this reagent from the step?')) {
      return;
    }

    this.stepReagentService.deleteStepReagent(reagentId).subscribe({
      next: () => {
        this.toastService.success('Reagent removed from step');
        this.loadStepReagents(stepId);
      },
      error: (err) => {
        this.toastService.error('Failed to remove reagent');
        console.error('Error removing reagent:', err);
      }
    });
  }

  copyTemplateToClipboard(reagentId: number, property: 'name' | 'quantity' | 'scaled_quantity' | 'unit'): void {
    const template = `%${reagentId}.${property}%`;

    navigator.clipboard.writeText(template).then(
      () => {
        this.toastService.success(`Template copied: ${template}`);
      },
      (err) => {
        console.error('Failed to copy template:', err);
        this.toastService.error('Failed to copy template to clipboard');
      }
    );
  }

  initiateSession(): void {
    const currentProtocol = this.protocol();
    if (!currentProtocol) {
      this.toastService.error('No protocol loaded');
      return;
    }

    const modalRef = this.modalService.open(SessionCreateModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.protocol = currentProtocol;

    modalRef.result.then(
      (session) => {
        this.toastService.success(`Session "${session.name}" created successfully`);
        this.router.navigate(['/protocols/sessions']);
      },
      () => {}
    );
  }
}
