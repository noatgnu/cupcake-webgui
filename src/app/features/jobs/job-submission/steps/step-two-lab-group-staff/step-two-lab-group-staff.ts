import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JobSubmissionStateService } from '../../services/job-submission-state';
import { LabGroup } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-step-two-lab-group-staff',
  imports: [CommonModule],
  templateUrl: './step-two-lab-group-staff.html',
  styleUrl: './step-two-lab-group-staff.scss'
})
export class StepTwoLabGroupStaffComponent {
  state = inject(JobSubmissionStateService);

  previous = output<void>();
  saveAndContinue = output<void>();

  canGoNext(): boolean {
    return this.state.selectedLabGroupId() !== null;
  }

  onLabGroupSearchInput(value: string): void {
    this.state.labGroupSearchTerm.set(value);
    this.state.labGroupSearchSubject.next(value);
    this.state.showLabGroupSuggestions.set(true);
  }

  selectLabGroup(labGroup: LabGroup): void {
    this.state.selectLabGroup(labGroup);
  }

  hideLabGroupSuggestions(): void {
    setTimeout(() => this.state.showLabGroupSuggestions.set(false), 200);
  }

  clearLabGroupAndStaff(): void {
    this.state.clearLabGroupAndStaff();
  }

  toggleStaffSelection(userId: number): void {
    this.state.toggleStaffSelection(userId);
  }

  onFunderSearchInput(value: string): void {
    this.state.funder.set(value);
    this.state.funderSearchTerm.set(value);
    this.state.funderSearchSubject.next(value);
    this.state.showFunderSuggestions.set(true);
  }

  selectFunder(funder: string): void {
    this.state.funder.set(funder);
    this.state.funderSearchTerm.set(funder);
    this.state.showFunderSuggestions.set(false);
  }

  hideFunderSuggestions(): void {
    setTimeout(() => this.state.showFunderSuggestions.set(false), 200);
  }

  onCostCenterSearchInput(value: string): void {
    this.state.costCenter.set(value);
    this.state.costCenterSearchTerm.set(value);
    this.state.costCenterSearchSubject.next(value);
    this.state.showCostCenterSuggestions.set(true);
  }

  selectCostCenter(costCenter: string): void {
    this.state.costCenter.set(costCenter);
    this.state.costCenterSearchTerm.set(costCenter);
    this.state.showCostCenterSuggestions.set(false);
  }

  hideCostCenterSuggestions(): void {
    setTimeout(() => this.state.showCostCenterSuggestions.set(false), 200);
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onSaveAndContinue(): void {
    this.saveAndContinue.emit();
  }
}
