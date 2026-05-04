import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionWebrtcPanel } from './session-webrtc-panel';
import {
  WebRTCService,
  WebRTCSignallingService,
  WebRTCSessionService,
  PeerRole,
  PeerConnectionState,
  PeerInfo
} from '@noatgnu/cupcake-mint-chocolate';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { signal } from '@angular/core';

describe('SessionWebrtcPanel', () => {
  let component: SessionWebrtcPanel;
  let fixture: ComponentFixture<SessionWebrtcPanel>;
  let mockWebRTCService: jasmine.SpyObj<WebRTCService>;
  let mockSignalingService: jasmine.SpyObj<WebRTCSignallingService>;
  let mockWebRTCSessionService: jasmine.SpyObj<WebRTCSessionService>;
  let mockSessionService: jasmine.SpyObj<SessionService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let connectedSubject: BehaviorSubject<boolean>;
  let peersValue: PeerInfo[];

  beforeEach(async () => {
    connectedSubject = new BehaviorSubject<boolean>(false);
    peersValue = [];

    mockWebRTCService = jasmine.createSpyObj('WebRTCService', [
      'startSession',
      'endSession',
      'startScreenShare',
      'stopScreenShare',
      'enableVideo',
      'disableVideo',
      'enableAudio',
      'disableAudio'
    ], {
      connectionState$: new BehaviorSubject<string>('disconnected').asObservable(),
      localStream$: new Subject<MediaStream | null>().asObservable(),
      remoteStreams$: new Subject<Map<string, MediaStream>>().asObservable(),
      activePeers$: new Subject<PeerInfo[]>().asObservable(),
      chatMessages$: new Subject<any>().asObservable(),
      fileTransferProgress$: new Subject<any>().asObservable(),
      dataChannelReady$: new Subject<boolean>().asObservable(),
      localMediaStream: null
    });

    mockSignalingService = jasmine.createSpyObj('WebRTCSignallingService', ['sendPeerState'], {
      connected$: connectedSubject.asObservable()
    });
    Object.defineProperty(mockSignalingService, 'peers', {
      get: () => peersValue,
      configurable: true
    });

    mockWebRTCSessionService = jasmine.createSpyObj('WebRTCSessionService', [
      'getSessions',
      'createSession',
      'deleteSession'
    ]);
    mockWebRTCSessionService.getSessions.and.returnValue(of({ count: 0, results: [] }));

    mockSessionService = jasmine.createSpyObj('SessionService', ['joinDefaultWebRTC']);

    mockToastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info']);

    mockAuthService = jasmine.createSpyObj('AuthService', [], {
      currentUser: signal(null)
    });

    await TestBed.configureTestingModule({
      imports: [SessionWebrtcPanel],
      providers: [
        { provide: WebRTCService, useValue: mockWebRTCService },
        { provide: WebRTCSignallingService, useValue: mockSignalingService },
        { provide: WebRTCSessionService, useValue: mockWebRTCSessionService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionWebrtcPanel);
    component = fixture.componentInstance;
    component.ccrvSessionId = 1;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.isConnected()).toBeFalse();
    expect(component.videoEnabled()).toBeFalse();
    expect(component.audioEnabled()).toBeFalse();
    expect(component.screenShareEnabled()).toBeFalse();
    expect(component.isExpanded()).toBeFalse();
    expect(component.remotePeers()).toEqual([]);
  });

  it('should set isConnected when signalingService connects', () => {
    expect(component.isConnected()).toBeFalse();
    connectedSubject.next(true);
    expect(component.isConnected()).toBeTrue();
  });

  it('should disconnect from WebRTC session', () => {
    component.isConnected.set(true);
    component.disconnect();
    expect(mockWebRTCService.endSession).toHaveBeenCalled();
    expect(component.isConnected()).toBeFalse();
    expect(component.remotePeers()).toEqual([]);
    expect(mockToastService.info).toHaveBeenCalledWith('Disconnected from WebRTC session');
  });

  it('should start screen sharing', async () => {
    mockWebRTCService.startScreenShare.and.returnValue(Promise.resolve());
    await component.toggleScreenShare();
    expect(mockWebRTCService.startScreenShare).toHaveBeenCalled();
    expect(component.screenShareEnabled()).toBeTrue();
    expect(mockSignalingService.sendPeerState).toHaveBeenCalledWith(undefined, undefined, undefined, true);
    expect(mockToastService.success).toHaveBeenCalledWith('Screen sharing started');
  });

  it('should stop screen sharing', async () => {
    component.screenShareEnabled.set(true);
    await component.toggleScreenShare();
    expect(mockWebRTCService.stopScreenShare).toHaveBeenCalled();
    expect(component.screenShareEnabled()).toBeFalse();
    expect(mockSignalingService.sendPeerState).toHaveBeenCalledWith(undefined, undefined, undefined, false);
    expect(mockToastService.info).toHaveBeenCalledWith('Screen sharing stopped');
  });

  it('should handle screen share error', async () => {
    mockWebRTCService.startScreenShare.and.returnValue(Promise.reject(new Error('Screen share failed')));
    await component.toggleScreenShare();
    expect(mockToastService.error).toHaveBeenCalledWith('Failed to start screen sharing');
    expect(component.screenShareEnabled()).toBeFalse();
  });

  it('should toggle expanded state', () => {
    expect(component.isExpanded()).toBeFalse();
    component.toggleExpand();
    expect(component.isExpanded()).toBeTrue();
    component.toggleExpand();
    expect(component.isExpanded()).toBeFalse();
  });

  it('should calculate active peers count', () => {
    expect(component.activePeersCount()).toBe(0);
    component.remotePeers.set([{
      peerId: 'peer-1',
      userId: 1,
      username: 'User 1',
      role: PeerRole.PARTICIPANT,
      hasVideo: true,
      hasAudio: true,
      hasScreenShare: false,
      connectionState: PeerConnectionState.CONNECTED
    }]);
    expect(component.activePeersCount()).toBe(1);
  });

  it('should cleanup on destroy', () => {
    spyOn(component['destroy$'], 'next');
    spyOn(component['destroy$'], 'complete');
    component.ngOnDestroy();
    expect(mockWebRTCService.endSession).toHaveBeenCalled();
    expect(component['destroy$'].next).toHaveBeenCalled();
    expect(component['destroy$'].complete).toHaveBeenCalled();
  });
});
