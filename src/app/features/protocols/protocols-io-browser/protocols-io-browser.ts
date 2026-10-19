import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ToastService } from '@noatgnu/cupcake-core';
import {
  ProtocolsIOAccountService,
  ProtocolsIOBrowseEntry,
  ProtocolsIOBrowseService,
  ProtocolsIOFolderEntry,
  ProtocolsIOPage,
  ProtocolsIOProtocolEntry,
  ProtocolsIOWorkspace
} from '@noatgnu/cupcake-red-velvet';

type BrowseLevel = 'workspaces' | 'workspace' | 'folder' | 'search';

interface BrowseCrumb {
  level: BrowseLevel;
  label: string;
  ref: string;
}

const ROOT_CRUMB: BrowseCrumb = { level: 'workspaces', label: 'Workspaces', ref: '' };
const ACCOUNT_MISSING = 'Connect a protocols.io account first';

@Component({
  selector: 'app-protocols-io-browser',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './protocols-io-browser.html',
  styleUrl: './protocols-io-browser.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolsIoBrowser implements OnInit {
  private accountService = inject(ProtocolsIOAccountService);
  private browseService = inject(ProtocolsIOBrowseService);
  private toastService = inject(ToastService);

  actionLabel = input('Select');
  busyUri = input<string | null>(null);
  protocolChosen = output<ProtocolsIOProtocolEntry>();

  connected = signal<boolean | null>(null);
  loading = signal(false);
  crumbs = signal<BrowseCrumb[]>([ROOT_CRUMB]);
  workspaces = signal<ProtocolsIOWorkspace[]>([]);
  entries = signal<ProtocolsIOBrowseEntry[]>([]);
  page = signal(1);
  hasNext = signal(false);
  totalPages = signal(1);
  searchText = signal('');

  current = computed(() => this.crumbs()[this.crumbs().length - 1]);

  ngOnInit(): void {
    this.accountService.getStatus().subscribe({
      next: status => {
        this.connected.set(status.connected);
        if (status.connected) {
          this.load();
        }
      },
      error: () => this.toastService.error('Failed to load the protocols.io account')
    });
  }

  load(): void {
    const crumb = this.current();
    this.loading.set(true);
    if (crumb.level === 'workspaces') {
      this.fetch(this.browseService.getWorkspaces(this.page()), page => {
        this.workspaces.set(page.items);
        this.entries.set([]);
      });
      return;
    }
    const request: Observable<ProtocolsIOPage<ProtocolsIOBrowseEntry>> =
      crumb.level === 'workspace' ? this.browseService.getWorkspaceItems(crumb.ref, this.page()) :
      crumb.level === 'folder' ? this.browseService.getFolderItems(crumb.ref, this.page()) :
      this.browseService.search(crumb.ref, this.page());
    this.fetch(request, page => {
      this.entries.set(page.items);
      this.workspaces.set([]);
    });
  }

  openWorkspace(workspace: ProtocolsIOWorkspace): void {
    this.descend({ level: 'workspace', label: workspace.title || workspace.uri, ref: workspace.uri });
  }

  openFolder(folder: ProtocolsIOFolderEntry): void {
    this.descend({ level: 'folder', label: folder.title, ref: folder.guid });
  }

  goTo(index: number): void {
    this.crumbs.set(this.crumbs().slice(0, index + 1));
    this.page.set(1);
    this.load();
  }

  search(): void {
    const text = this.searchText().trim();
    if (!text) {
      return;
    }
    this.crumbs.set([ROOT_CRUMB, { level: 'search', label: `Search "${text}"`, ref: text }]);
    this.page.set(1);
    this.load();
  }

  changePage(step: number): void {
    this.page.set(Math.max(1, this.page() + step));
    this.load();
  }

  choose(entry: ProtocolsIOProtocolEntry): void {
    if (entry.importable) {
      this.protocolChosen.emit(entry);
    }
  }

  modifiedDate(entry: ProtocolsIOProtocolEntry): number | null {
    return entry.lastModified ? entry.lastModified * 1000 : null;
  }

  private descend(crumb: BrowseCrumb): void {
    this.crumbs.set([...this.crumbs(), crumb]);
    this.page.set(1);
    this.load();
  }

  private fetch<T>(request: Observable<ProtocolsIOPage<T>>, apply: (page: ProtocolsIOPage<T>) => void): void {
    request.subscribe({
      next: page => {
        apply(page);
        this.hasNext.set(page.hasNext);
        this.totalPages.set(Math.max(1, page.totalPages));
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        const message = error.error?.error;
        if (message === ACCOUNT_MISSING) {
          this.connected.set(false);
          return;
        }
        this.toastService.error(message || 'Failed to load protocols.io');
      }
    });
  }
}
