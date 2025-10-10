import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ContactService, ExternalContact } from '@noatgnu/cupcake-macaron';
import { ToastService } from '@noatgnu/cupcake-core';
import { ExternalContactModal } from '../external-contact-modal/external-contact-modal';

@Component({
  selector: 'app-contacts-management-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './contacts-management-modal.html',
  styleUrl: './contacts-management-modal.scss'
})
export class ContactsManagementModal implements OnInit {
  private activeModal = inject(NgbActiveModal);
  private contactService = inject(ContactService);
  private toastService = inject(ToastService);
  private modalService = inject(NgbModal);

  contacts = signal<ExternalContact[]>([]);
  loading = signal(false);
  searchQuery = '';

  ngOnInit(): void {
    this.loadContacts();
  }

  loadContacts(): void {
    this.loading.set(true);
    this.contactService.getExternalContacts({ search: this.searchQuery }).subscribe({
      next: (response) => {
        this.contacts.set(response.results);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading contacts:', error);
        this.toastService.error('Failed to load contacts');
        this.loading.set(false);
      }
    });
  }

  searchContacts(): void {
    this.loadContacts();
  }

  openContactModal(mode: 'create' | 'edit' | 'view', contact?: ExternalContact): void {
    const modalRef = this.modalService.open(ExternalContactModal, { size: 'lg' });
    modalRef.componentInstance.mode = mode;
    if (contact) {
      modalRef.componentInstance.contact = contact;
    }

    modalRef.result.then(
      (result: ExternalContact) => {
        this.loadContacts();
      },
      () => {}
    );
  }

  deleteContact(contact: ExternalContact): void {
    if (confirm(`Are you sure you want to delete contact "${contact.contactName}"?`)) {
      this.contactService.deleteExternalContact(contact.id).subscribe({
        next: () => {
          this.toastService.success('Contact deleted successfully');
          this.loadContacts();
        },
        error: (error) => {
          console.error('Error deleting contact:', error);
          this.toastService.error('Failed to delete contact');
        }
      });
    }
  }

  close(): void {
    this.activeModal.close();
  }
}
