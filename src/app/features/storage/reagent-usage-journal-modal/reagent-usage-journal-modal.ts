import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ReagentUsageJournal } from '../reagent-usage-journal/reagent-usage-journal';
import type { StoredReagent } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-reagent-usage-journal-modal',
  imports: [CommonModule, ReagentUsageJournal],
  templateUrl: './reagent-usage-journal-modal.html',
  styleUrl: './reagent-usage-journal-modal.scss'
})
export class ReagentUsageJournalModal {
  private activeModal = inject(NgbActiveModal);

  @Input() storedReagent!: StoredReagent;

  close(): void {
    this.activeModal.dismiss();
  }
}
