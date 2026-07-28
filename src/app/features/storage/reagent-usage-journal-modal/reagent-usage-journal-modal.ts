import { Component, inject, Input, ChangeDetectionStrategy } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ReagentUsageJournal } from '../reagent-usage-journal/reagent-usage-journal';
import type { StoredReagent } from '@noatgnu/cupcake-macaron';

@Component({
  selector: 'app-reagent-usage-journal-modal',
  imports: [ReagentUsageJournal],
  templateUrl: './reagent-usage-journal-modal.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './reagent-usage-journal-modal.scss'
})
export class ReagentUsageJournalModal {
  private activeModal = inject(NgbActiveModal);

  @Input() storedReagent!: StoredReagent;

  close(): void {
    this.activeModal.dismiss();
  }
}
