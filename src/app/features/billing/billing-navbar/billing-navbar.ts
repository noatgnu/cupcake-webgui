import { Component, inject, signal } from '@angular/core';

import { RouterModule } from '@angular/router';
import { NgbCollapse, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SidebarControl } from '../../../core/services/sidebar-control';
import { QuoteRequestModal } from '../quote-request-modal/quote-request-modal';

@Component({
  selector: 'app-billing-navbar',
  imports: [RouterModule, NgbCollapse],
  templateUrl: './billing-navbar.html',
  styleUrl: './billing-navbar.scss',
})
export class BillingNavbar {
  private sidebarControl = inject(SidebarControl);
  private modalService = inject(NgbModal);

  isMenuCollapsed = signal(true);

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
