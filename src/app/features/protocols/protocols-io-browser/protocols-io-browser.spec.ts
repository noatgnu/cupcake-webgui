import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ToastService } from '@noatgnu/cupcake-core';
import {
  ProtocolsIOAccountService,
  ProtocolsIOBrowseService,
  ProtocolsIOFolderEntry,
  ProtocolsIOPage,
  ProtocolsIOProtocolEntry,
  ProtocolsIOWorkspace
} from '@noatgnu/cupcake-protocols-io';

import { ProtocolsIoBrowser } from './protocols-io-browser';

function page<T>(items: T[], hasNext = false): ProtocolsIOPage<T> {
  return { items, page: 1, totalPages: hasNext ? 2 : 1, totalResults: items.length, hasNext };
}

describe('ProtocolsIoBrowser', () => {
  let component: ProtocolsIoBrowser;
  let fixture: ComponentFixture<ProtocolsIoBrowser>;
  let accountService: jasmine.SpyObj<ProtocolsIOAccountService>;
  let browseService: jasmine.SpyObj<ProtocolsIOBrowseService>;
  let toastService: jasmine.SpyObj<ToastService>;

  const workspace: ProtocolsIOWorkspace = { uri: 'lrrk2', title: 'lrrk2', description: '' };
  const folder: ProtocolsIOFolderEntry = {
    kind: 'folder', title: 'Toan Phung', guid: 'C5463D4B', parentGuid: null, hasSubfolders: false,
    workspace: { id: 59673, title: 'lrrk2' }
  };
  const protocol: ProtocolsIOProtocolEntry = {
    kind: 'protocol', title: 'Cupcake export test', id: 340067, uri: 'cupcake-export-test-kqcbcvssp',
    protocolType: 'protocol', importable: true, lastModified: 1792352685, workspace: { id: 59673, title: 'lrrk2' }
  };
  const collection: ProtocolsIOProtocolEntry = { ...protocol, id: 5, uri: 'lysis-collection', title: 'Lysis collection', protocolType: 'collection', importable: false };

  async function create(connected = true, mode: 'protocol' | 'folder' = 'protocol'): Promise<void> {
    accountService.getStatus.and.returnValue(of({ connected }));
    await TestBed.configureTestingModule({
      imports: [ProtocolsIoBrowser],
      providers: [
        provideRouter([]),
        { provide: ProtocolsIOAccountService, useValue: accountService },
        { provide: ProtocolsIOBrowseService, useValue: browseService },
        { provide: ToastService, useValue: toastService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProtocolsIoBrowser);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
  }

  function rows(selector: string): HTMLElement[] {
    fixture.detectChanges();
    return Array.from(fixture.nativeElement.querySelectorAll(selector));
  }

  beforeEach(() => {
    accountService = jasmine.createSpyObj('ProtocolsIOAccountService', ['getStatus']);
    browseService = jasmine.createSpyObj('ProtocolsIOBrowseService', ['getWorkspaces', 'getWorkspaceItems', 'getFolderItems', 'search']);
    toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    browseService.getWorkspaces.and.returnValue(of(page([workspace])));
    browseService.getWorkspaceItems.and.returnValue(of(page([folder])));
    browseService.getFolderItems.and.returnValue(of(page<ProtocolsIOFolderEntry | ProtocolsIOProtocolEntry>([protocol, collection], true)));
    browseService.search.and.returnValue(of(page([protocol])));
  });

  it('should point to the account page without a connected account', async () => {
    await create(false);
    expect(fixture.nativeElement.querySelector('.not-connected')).toBeTruthy();
    expect(browseService.getWorkspaces).not.toHaveBeenCalled();
  });

  it('should go from workspaces to folders to protocols with breadcrumbs', async () => {
    await create();
    rows('.workspace-row')[0].click();
    expect(browseService.getWorkspaceItems).toHaveBeenCalledWith('lrrk2', 1);
    rows('.folder-row')[0].click();
    expect(browseService.getFolderItems).toHaveBeenCalledWith('C5463D4B', 1);
    expect(rows('.protocol-row').length).toBe(2);
    expect(component.crumbs().map(crumb => crumb.label)).toEqual(['Workspaces', 'lrrk2', 'Toan Phung']);
    component.goTo(0);
    expect(rows('.workspace-row').length).toBe(1);
  });

  it('should emit importable protocols and keep others disabled', async () => {
    await create();
    const chosen: ProtocolsIOProtocolEntry[] = [];
    component.protocolChosen.subscribe(entry => chosen.push(entry));
    component.openFolder(folder);
    const buttons = rows('.choose-protocol') as HTMLButtonElement[];
    expect(buttons[1].disabled).toBeTrue();
    buttons[0].click();
    component.choose(collection);
    expect(chosen).toEqual([protocol]);
  });

  it('should offer only folders in folder mode', async () => {
    browseService.getFolderItems.and.returnValue(of(page<ProtocolsIOFolderEntry | ProtocolsIOProtocolEntry>([folder, protocol])));
    await create(true, 'folder');
    expect(fixture.nativeElement.querySelector('input[type="search"]')).toBeNull();
    const chosen: ProtocolsIOFolderEntry[] = [];
    component.folderChosen.subscribe(entry => chosen.push(entry));
    component.openFolder(folder);
    expect(rows('.protocol-row').length).toBe(0);
    (rows('.choose-folder')[0] as HTMLButtonElement).click();
    expect(chosen).toEqual([folder]);
    expect(component.crumbs().length).toBe(2);
  });

  it('should page through folder contents', async () => {
    await create();
    component.openFolder(folder);
    (rows('.next-page')[0] as HTMLButtonElement).click();
    expect(browseService.getFolderItems).toHaveBeenCalledWith('C5463D4B', 2);
  });

  it('should search', async () => {
    await create();
    component.searchText.set(' cupcake ');
    component.search();
    expect(browseService.search).toHaveBeenCalledWith('cupcake', 1);
    expect(component.current().label).toBe('Search "cupcake"');
  });

  it('should switch to the connect prompt when the account is gone', async () => {
    await create();
    browseService.getWorkspaceItems.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { error: 'Connect a protocols.io account first' }
    })));
    component.openWorkspace(workspace);
    expect(component.connected()).toBeFalse();
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('should report protocols.io failures', async () => {
    await create();
    browseService.getWorkspaceItems.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 502, error: { error: 'protocols.io request failed' }
    })));
    component.openWorkspace(workspace);
    expect(toastService.error).toHaveBeenCalledWith('protocols.io request failed');
    expect(component.loading()).toBeFalse();
  });
});
