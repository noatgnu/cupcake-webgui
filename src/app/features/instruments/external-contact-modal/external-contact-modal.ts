import { Component, Input, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import {
  ExternalContact,
  ContactService,
  ExternalContactCreateRequest,
  ExternalContactUpdateRequest,
  ExternalContactDetails,
  ExternalContactDetailsCreateRequest,
  ExternalContactDetailsUpdateRequest,
  ContactType
} from '@noatgnu/cupcake-macaron';
import { ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-external-contact-modal',
  imports: [FormsModule],
  templateUrl: './external-contact-modal.html',
  styleUrl: './external-contact-modal.scss'
})
export class ExternalContactModal {
  @Input() contact?: ExternalContact;
  @Input() mode: 'create' | 'edit' | 'view' = 'create';

  contactName = '';
  contactDetails = signal<ExternalContactDetails[]>([]);
  saving = signal(false);
  loading = signal(false);

  newDetailType: ContactType = ContactType.EMAIL;
  newDetailName = '';
  newDetailValue = '';
  editingDetailId: number | null = null;

  contactTypes = Object.values(ContactType);

  constructor(
    public activeModal: NgbActiveModal,
    private contactService: ContactService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    if (this.contact) {
      this.contactName = this.contact.contactName;
      if (this.contact.contactDetails) {
        this.contactDetails.set([...this.contact.contactDetails]);
      }
    }
  }

  addContactDetail(): void {
    if (!this.newDetailName || !this.newDetailValue) {
      this.toastService.error('Please fill in all contact detail fields');
      return;
    }

    const detailRequest: ExternalContactDetailsCreateRequest = {
      contactMethodAltName: this.newDetailName,
      contactType: this.newDetailType,
      contactValue: this.newDetailValue
    };

    this.saving.set(true);
    this.contactService.createExternalContactDetail(detailRequest).subscribe({
      next: (detail) => {
        this.contactDetails.update(details => [...details, detail]);
        this.newDetailName = '';
        this.newDetailValue = '';
        this.newDetailType = ContactType.EMAIL;
        this.saving.set(false);
        this.toastService.success('Contact detail added successfully');
      },
      error: (error) => {
        console.error('Error creating contact detail:', error);
        this.toastService.error('Failed to create contact detail');
        this.saving.set(false);
      }
    });
  }

  removeContactDetail(detail: ExternalContactDetails): void {
    if (detail.id) {
      this.saving.set(true);
      this.contactService.deleteExternalContactDetail(detail.id).subscribe({
        next: () => {
          this.contactDetails.update(details => details.filter(d => d.id !== detail.id));
          this.saving.set(false);
          this.toastService.success('Contact detail removed successfully');
        },
        error: (error) => {
          console.error('Error removing contact detail:', error);
          this.toastService.error('Failed to remove contact detail');
          this.saving.set(false);
        }
      });
    }
  }

  save(): void {
    if (!this.contactName) {
      this.toastService.error('Please enter a contact name');
      return;
    }

    this.saving.set(true);

    const contactDetailsIds = this.contactDetails().map(d => d.id);

    if (this.mode === 'edit' && this.contact) {
      const updateRequest: ExternalContactUpdateRequest = {
        contactName: this.contactName,
        contactDetailsIds
      };

      this.contactService.updateExternalContact(this.contact.id, updateRequest).subscribe({
        next: (updatedContact) => {
          this.toastService.success('Contact updated successfully');
          this.activeModal.close(updatedContact);
          this.saving.set(false);
        },
        error: (error) => {
          console.error('Error updating contact:', error);
          this.toastService.error('Failed to update contact');
          this.saving.set(false);
        }
      });
    } else {
      const createRequest: ExternalContactCreateRequest = {
        contactName: this.contactName,
        contactDetailsIds
      };

      this.contactService.createExternalContact(createRequest).subscribe({
        next: (newContact) => {
          this.toastService.success('Contact created successfully');
          this.activeModal.close(newContact);
          this.saving.set(false);
        },
        error: (error) => {
          console.error('Error creating contact:', error);
          this.toastService.error('Failed to create contact');
          this.saving.set(false);
        }
      });
    }
  }

  cancel(): void {
    this.activeModal.dismiss();
  }

  getContactTypeIcon(type: ContactType): string {
    switch (type) {
      case ContactType.EMAIL:
        return 'bi-envelope';
      case ContactType.PHONE:
        return 'bi-telephone';
      case ContactType.ADDRESS:
        return 'bi-geo-alt';
      default:
        return 'bi-info-circle';
    }
  }

  getContactTypeLabel(type: ContactType): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  get isEdit(): boolean {
    return this.mode === 'edit';
  }

  get isView(): boolean {
    return this.mode === 'view';
  }
}
