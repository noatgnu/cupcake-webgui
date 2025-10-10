import { Component, ElementRef, inject, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProtocolStepService, StepReagentService } from '@noatgnu/cupcake-red-velvet';
import type { StepReagent } from '@noatgnu/cupcake-red-velvet';
import { ToastService } from '@noatgnu/cupcake-core';
import { DurationInput } from '../../../shared/components/duration-input/duration-input';
import { QuillModule } from 'ngx-quill';
import type { ContentChange } from 'ngx-quill';

@Component({
  selector: 'app-step-create-modal',
  imports: [CommonModule, ReactiveFormsModule, DurationInput, QuillModule],
  templateUrl: './step-create-modal.html',
  styleUrl: './step-create-modal.scss'
})
export class StepCreateModal {
  private fb = inject(FormBuilder);
  private stepService = inject(ProtocolStepService);
  private stepReagentService = inject(StepReagentService);
  private toastService = inject(ToastService);
  activeModal = inject(NgbActiveModal);

  @Input() protocolId!: number;
  @Input() sectionId!: number;
  @Input() order!: number;
  @ViewChild('dropdownMenu') dropdownMenu!: ElementRef;

  stepForm: FormGroup = this.fb.group({
    stepDescription: ['', Validators.required],
    stepDuration: [0]
  });

  saving = false;
  showTemplateHelp = false;
  reagents: StepReagent[] = [];
  currentCursorIndex = 0;

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

  createStep(): void {
    if (!this.stepForm.valid) {
      this.toastService.error('Please fill in required fields');
      return;
    }

    this.saving = true;
    const formValue = this.stepForm.value;

    this.stepService.createProtocolStep({
      protocol: this.protocolId,
      stepSection: this.sectionId,
      stepDescription: formValue.stepDescription,
      stepDuration: formValue.stepDuration,
      order: this.order
    }).subscribe({
      next: (step) => {
        this.toastService.success('Step created successfully');
        this.activeModal.close(step);
      },
      error: (err) => {
        this.toastService.error('Failed to create step');
        console.error('Error creating step:', err);
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
      this.quillEditor.focus();
    }
  }

  insertReagentTemplate(reagentId: number, property: 'name' | 'quantity' | 'scaled_quantity' | 'unit' = 'quantity'): void {
    const template = `${reagentId}.${property}%`;
    if (this.quillEditor) {
      this.quillEditor.insertText(this.currentCursorIndex + 1, template);
      const newContent = this.quillEditor.root.innerHTML;
      this.stepForm.patchValue({ stepDescription: newContent });
    }
    if (this.dropdownMenu) {
      this.dropdownMenu.nativeElement.style.display = 'none';
    }
  }

  toggleTemplateHelp(): void {
    this.showTemplateHelp = !this.showTemplateHelp;
  }

  onContentChanged(event: ContentChange): void {
    const index = event.editor.selection?.lastRange?.index;
    if (index && index > 0) {
      this.currentCursorIndex = index;
      const text = event.text;
      if (text.length > 1) {
        if (text[index] === '%' && text[index - 1] === ' ') {
          this.showDropdownAtCursor();
          return;
        }
      }
    }
    if (this.dropdownMenu) {
      this.dropdownMenu.nativeElement.style.display = 'none';
    }
  }

  showDropdownAtCursor(): void {
    if (!this.quillEditor || !this.dropdownMenu) {
      return;
    }

    const bounds = this.quillEditor.getBounds(this.currentCursorIndex);
    if (!bounds) {
      return;
    }

    const container = this.quillEditor.container;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const parent = this.quillEditor.root.parentElement;
    const toolbar = parent?.querySelector('.ql-toolbar');

    if (!toolbar) {
      return;
    }

    const toolbarHeight = toolbar.scrollHeight;

    this.dropdownMenu.nativeElement.style.position = 'absolute';
    this.dropdownMenu.nativeElement.style.left = `${bounds.left + scrollLeft}px`;
    this.dropdownMenu.nativeElement.style.top = `${bounds.top + scrollTop + toolbarHeight}px`;
    this.dropdownMenu.nativeElement.style.display = 'block';
  }

  hasScalableReagents(): boolean {
    return this.reagents.some(r => r.scalable === true);
  }
}
