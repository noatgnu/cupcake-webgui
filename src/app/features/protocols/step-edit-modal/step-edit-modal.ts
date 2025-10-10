import { Component, ElementRef, inject, Input, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProtocolStepService, StepReagentService } from '@noatgnu/cupcake-red-velvet';
import type { ProtocolStep, StepReagent } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { DurationInput } from '../../../shared/components/duration-input/duration-input';
import { QuillModule } from 'ngx-quill';
import type { ContentChange } from 'ngx-quill';
import { StepTemplatePipe } from '../../../shared/pipes/step-template-pipe';

@Component({
  selector: 'app-step-edit-modal',
  imports: [CommonModule, ReactiveFormsModule, DurationInput, QuillModule, StepTemplatePipe],
  templateUrl: './step-edit-modal.html',
  styleUrl: './step-edit-modal.scss'
})
export class StepEditModal implements OnInit {
  private fb = inject(FormBuilder);
  private stepService = inject(ProtocolStepService);
  private stepReagentService = inject(StepReagentService);
  private toastService = inject(ToastService);
  activeModal = inject(NgbActiveModal);

  @Input() step!: ProtocolStep;
  @ViewChild('dropdownMenu') dropdownMenu!: ElementRef;

  stepForm: FormGroup = this.fb.group({
    stepDescription: ['', Validators.required],
    stepDuration: [0]
  });

  saving = false;
  showTemplateHelp = false;
  showPreview = false;
  reagents: StepReagent[] = [];
  filteredReagents: StepReagent[] = [];
  currentCursorIndex = 0;
  dropdownVisible = false;

  quillEditor: any;

  quillConfig = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link']
    ]
  };

  ngOnInit(): void {
    if (this.step) {
      this.stepForm.patchValue({
        stepDescription: this.step.stepDescription,
        stepDuration: this.step.stepDuration || 0
      });
      this.loadStepReagents();
    }
  }

  loadStepReagents(): void {
    this.stepReagentService.getReagentsByStep(this.step.id).subscribe({
      next: (response) => {
        this.reagents = response.results;
        this.filteredReagents = [...this.reagents];
      },
      error: (err) => {
        console.error('Error loading step reagents:', err);
      }
    });
  }

  onContentChanged(event: ContentChange): void {
    if (!event.editor) {
      this.hideDropdown();
      return;
    }

    const selection = event.editor.getSelection();
    if (!selection || selection.index === null || selection.index === undefined) {
      this.hideDropdown();
      return;
    }

    const index = selection.index;
    this.currentCursorIndex = index;
    const text = event.text || '';

    console.log('Content changed:', { index, text: text.substring(Math.max(0, index - 5), index + 5), char: text[index - 1] });

    let searchStart = -1;
    for (let i = index - 1; i >= 0; i--) {
      const char = text[i];
      if (char === ' ' || char === '\n') {
        if (i + 1 < index && text[i + 1] === '%') {
          searchStart = i + 2;
        }
        break;
      }
      if (i === 0) {
        if (text[0] === '%') {
          searchStart = 1;
        }
        break;
      }
    }

    console.log('Search start:', searchStart, 'Reagents:', this.reagents.length, 'Filtered:', this.filteredReagents.length);

    if (searchStart >= 0 && searchStart <= index) {
      const searchTerm = text.substring(searchStart, index).toLowerCase();
      console.log('Showing dropdown with search term:', searchTerm);
      this.filterReagents(searchTerm);
      this.showDropdownAtCursor();
    } else {
      this.hideDropdown();
    }
  }

  filterReagents(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredReagents = [...this.reagents];
      return;
    }

    this.filteredReagents = this.reagents.filter(r => {
      const idMatch = r.id.toString().includes(searchTerm);
      const nameMatch = r.reagentName?.toLowerCase().includes(searchTerm);
      return idMatch || nameMatch;
    });
  }

  hideDropdown(): void {
    this.dropdownVisible = false;
    if (this.dropdownMenu) {
      this.dropdownMenu.nativeElement.style.display = 'none';
    }
  }

  showDropdownAtCursor(): void {
    console.log('showDropdownAtCursor called', {
      hasEditor: !!this.quillEditor,
      hasDropdown: !!this.dropdownMenu?.nativeElement,
      currentCursorIndex: this.currentCursorIndex
    });

    if (!this.quillEditor || !this.dropdownMenu?.nativeElement) {
      console.log('Missing editor or dropdown element');
      return;
    }

    const bounds = this.quillEditor.getBounds(this.currentCursorIndex);
    if (!bounds) {
      console.log('No bounds found for cursor position');
      return;
    }

    console.log('Bounds:', bounds);

    const editorContainer = this.quillEditor.container;
    const editorRect = editorContainer.getBoundingClientRect();

    this.dropdownVisible = true;
    const menuEl = this.dropdownMenu.nativeElement;
    menuEl.style.position = 'fixed';
    menuEl.style.left = `${editorRect.left + bounds.left}px`;
    menuEl.style.top = `${editorRect.top + bounds.bottom + 5}px`;
    menuEl.style.display = 'block';

    console.log('Dropdown should now be visible at', {
      left: menuEl.style.left,
      top: menuEl.style.top,
      bounds,
      editorRect
    });
  }

  hasScalableReagents(): boolean {
    return this.reagents.some(r => r.scalable === true);
  }

  updateStep(): void {
    if (!this.stepForm.valid) {
      this.toastService.error('Please fill in required fields');
      return;
    }

    this.saving = true;
    const formValue = this.stepForm.value;

    this.stepService.patchProtocolStep(this.step.id, {
      stepDescription: formValue.stepDescription,
      stepDuration: formValue.stepDuration
    }).subscribe({
      next: (step) => {
        this.toastService.success('Step updated successfully');
        this.activeModal.close(step);
      },
      error: (err) => {
        this.toastService.error('Failed to update step');
        console.error('Error updating step:', err);
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.activeModal.dismiss();
  }

  onEditorCreated(quill: any): void {
    this.quillEditor = quill;
  }

  insertTemplate(template: string): void {
    if (this.quillEditor) {
      const range = this.quillEditor.getSelection();
      if (range) {
        this.quillEditor.insertText(range.index, template);
        this.quillEditor.setSelection(range.index + template.length);
      } else {
        const length = this.quillEditor.getLength();
        this.quillEditor.insertText(length - 1, template);
      }

      const updatedContent = this.quillEditor.root.innerHTML;
      this.stepForm.patchValue({ stepDescription: updatedContent });
      this.quillEditor.focus();
    }
  }

  insertReagentTemplate(reagentId: number, property: 'name' | 'quantity' | 'scaled_quantity' | 'unit' = 'quantity'): void {
    const template = `${reagentId}.${property}%`;
    if (this.quillEditor) {
      const text = this.quillEditor.getText();
      let deleteStart = this.currentCursorIndex - 1;
      while (deleteStart >= 0 && text[deleteStart] !== ' ' && text[deleteStart] !== '\n') {
        deleteStart--;
      }
      deleteStart++;

      const deleteLength = this.currentCursorIndex - deleteStart;
      this.quillEditor.deleteText(deleteStart, deleteLength);
      this.quillEditor.insertText(deleteStart, '%' + template);

      const newCursorPosition = deleteStart + template.length + 1;

      const updatedContent = this.quillEditor.root.innerHTML;
      this.stepForm.patchValue({ stepDescription: updatedContent }, { emitEvent: false });

      setTimeout(() => {
        this.quillEditor.setSelection(newCursorPosition);
        this.quillEditor.focus();
      }, 0);
    }
    this.hideDropdown();
  }

  toggleTemplateHelp(): void {
    this.showTemplateHelp = !this.showTemplateHelp;
  }

  togglePreview(): void {
    this.showPreview = !this.showPreview;
    if (!this.showPreview) {
      this.hideDropdown();
    }
  }
}
