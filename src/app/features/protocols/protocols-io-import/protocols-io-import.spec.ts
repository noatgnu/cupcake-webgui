import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ToastService } from '@noatgnu/cupcake-core';
import {
  ProtocolModel,
  ProtocolsIOAccountService,
  ProtocolsIOBrowseService,
  ProtocolsIOProtocolEntry,
  ProtocolService
} from '@noatgnu/cupcake-red-velvet';

import { ProtocolsIoImport } from './protocols-io-import';

describe('ProtocolsIoImport', () => {
  let component: ProtocolsIoImport;
  let fixture: ComponentFixture<ProtocolsIoImport>;
  let protocolService: jasmine.SpyObj<ProtocolService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let router: Router;

  const entry: ProtocolsIOProtocolEntry = {
    kind: 'protocol', title: 'Cupcake export test', id: 340067, uri: 'cupcake-export-test-kqcbcvssp',
    protocolType: 'protocol', importable: true, lastModified: null, workspace: { id: 59673, title: 'lrrk2' }
  };

  beforeEach(async () => {
    protocolService = jasmine.createSpyObj('ProtocolService', ['importFromProtocolsIOAccount']);
    toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    const accountService = jasmine.createSpyObj('ProtocolsIOAccountService', ['getStatus']);
    accountService.getStatus.and.returnValue(of({ connected: false }));
    await TestBed.configureTestingModule({
      imports: [ProtocolsIoImport],
      providers: [
        provideRouter([]),
        { provide: ProtocolService, useValue: protocolService },
        { provide: ToastService, useValue: toastService },
        { provide: ProtocolsIOAccountService, useValue: accountService },
        { provide: ProtocolsIOBrowseService, useValue: jasmine.createSpyObj('ProtocolsIOBrowseService', ['getWorkspaces']) }
      ]
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture = TestBed.createComponent(ProtocolsIoImport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should import the chosen protocol and open it in the editor', () => {
    protocolService.importFromProtocolsIOAccount.and.returnValue(of({ id: 41 } as ProtocolModel));
    component.importProtocol(entry);
    expect(protocolService.importFromProtocolsIOAccount).toHaveBeenCalledWith('cupcake-export-test-kqcbcvssp');
    expect(router.navigate).toHaveBeenCalledWith(['/protocols', 41, 'edit']);
    expect(toastService.success).toHaveBeenCalledWith('Imported Cupcake export test');
    expect(component.importingUri()).toBeNull();
  });

  it('should report a failed import', () => {
    protocolService.importFromProtocolsIOAccount.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { error: 'Only protocols can be imported' }
    })));
    component.importProtocol(entry);
    expect(toastService.error).toHaveBeenCalledWith('Only protocols can be imported');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.importingUri()).toBeNull();
  });
});
