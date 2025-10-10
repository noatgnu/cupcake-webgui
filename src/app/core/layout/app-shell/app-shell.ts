import { Component, TemplateRef, ViewChild, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { Sidebar } from '../sidebar/sidebar';
import { SidebarControl } from '../../services/sidebar-control';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-app-shell',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss'
})
export class AppShell implements OnInit, OnDestroy {
  @ViewChild('sidebarContent') sidebarContent!: TemplateRef<any>;

  private offcanvasService = inject(NgbOffcanvas);
  private sidebarControl = inject(SidebarControl);
  private subscription?: Subscription;

  sidebarCollapsed = signal(false);

  ngOnInit(): void {
    this.subscription = this.sidebarControl.toggle$.subscribe(() => {
      this.toggleSidebar();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  toggleSidebar() {
    const isLargeScreen = window.innerWidth >= 768;

    if (isLargeScreen) {
      this.sidebarCollapsed.update(value => !value);
    } else {
      this.openSidebarOffcanvas();
    }
  }

  updateSidebarState(collapsed: boolean) {
    this.sidebarCollapsed.set(collapsed);
  }

  openSidebarOffcanvas() {
    this.offcanvasService.open(this.sidebarContent, {
      position: 'start',
      backdrop: true,
      keyboard: true,
      panelClass: 'd-md-none'
    });
  }
}
