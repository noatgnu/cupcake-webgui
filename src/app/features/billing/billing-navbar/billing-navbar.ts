import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { QuoteRequestModal } from '../quote-request-modal/quote-request-modal';

@Component({
  selector: 'app-billing-navbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './billing-navbar.html',
  styleUrl: './billing-navbar.scss',
})
export class BillingNavbar {
  private sidebarControl = inject(SidebarControl);
  private modalService = inject(NgbModal);

  onToggleSidebar(): void {
    this.sidebarControl.toggle();
  }

  openQuoteRequest(): void {
    this.modalService.open(QuoteRequestModal, {
      size: 'xl',
      scrollable: true
    });
  }
}
