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
  let chatMessages: Subject<any>;
  let remoteStreams: Subject<Map<string, MediaStream>>;
  let activePeers: Subject<PeerInfo[]>;
  let permissions: BehaviorSubject<Map<number, any>>;
  let ownPermissions: any;

  beforeEach(async () => {
    connectedSubject = new BehaviorSubject<boolean>(false);
    peersValue = [];
    chatMessages = new Subject<any>();
    remoteStreams = new Subject<Map<string, MediaStream>>();
    activePeers = new Subject<PeerInfo[]>();
    permissions = new BehaviorSubject<Map<number, any>>(new Map());
    ownPermissions = { audio: true, video: true, screenShare: true, chat: true };

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
      remoteStreams$: remoteStreams.asObservable(),
      activePeers$: activePeers.asObservable(),
      chatMessages$: chatMessages.asObservable(),
      fileTransferProgress$: new Subject<any>().asObservable(),
      dataChannelReady$: new Subject<boolean>().asObservable(),
      localMediaStream: null
    });

    mockSignalingService = jasmine.createSpyObj('WebRTCSignallingService', ['sendPeerState', 'setPermissions'], {
      connected$: connectedSubject.asObservable(),
      readOnly$: new BehaviorSubject<boolean>(false).asObservable(),
      canModerate$: new BehaviorSubject<boolean>(true).asObservable(),
      overrides$: new BehaviorSubject<Map<number, any>>(new Map()).asObservable(),
      permissions$: permissions.asObservable(),
      permissionChanges$: new Subject<any>().asObservable()
    });
    Object.defineProperty(mockSignalingService, 'ownPermissions', {
      get: () => ownPermissions,
      configurable: true
    });
    Object.defineProperty(mockSignalingService, 'peerId', {
      get: () => 'own-peer',
      configurable: true
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

  it('marks only messages sent from this browser as local', () => {
    const timestamp = '2026-11-13T17:00:00Z';
    chatMessages.next({ type: 'chat', peerId: 'own-peer', userId: 0, username: 'You', message: 'mine', timestamp });
    chatMessages.next({ type: 'chat', peerId: 'other-peer', userId: 2, username: 'colleague', message: 'theirs', timestamp });
    expect(component.chatMessages().map(message => [message.message, message.username, message.isLocal])).toEqual([
      ['mine', 'You', true],
      ['theirs', 'colleague', false]
    ]);
  });

  it('lets the session owner mute and reset what someone may send', () => {
    const peer = {
      peerId: 'peer-2', userId: 2, username: 'colleague', role: PeerRole.PARTICIPANT,
      hasVideo: false, hasAudio: true, hasScreenShare: false, connectionState: PeerConnectionState.CONNECTED
    };
    component.togglePermission(peer, 'audio');
    expect(mockSignalingService.setPermissions).toHaveBeenCalledWith(2, { audio: false });
    component.resetPermissions(peer);
    expect(mockSignalingService.setPermissions).toHaveBeenCalledWith(2, { audio: null, video: null, screenShare: null, chat: null });
  });

  it('turns off the controls the session owner has not allowed and says why', () => {
    component.videoEnabled.set(true);
    ownPermissions = { audio: true, video: false, screenShare: true, chat: false };
    permissions.next(new Map([[1, ownPermissions]]));
    expect(component.videoEnabled()).toBeFalse();
    expect(component.canSendMessages()).toBeFalse();
    expect(component.notAllowedTitle('video')).toBe('The session owner has not allowed you to turn on your camera');
    expect(component.notAllowedTitle('audio')).toBeNull();
  });

  it('keeps people without camera or microphone in the call when someone else leaves', () => {
    const person = (id: string, userId: number): PeerInfo => ({
      id, userId, username: id, peerRole: PeerRole.PARTICIPANT, connectionState: PeerConnectionState.CONNECTED,
      hasVideo: false, hasAudio: false, hasScreenShare: false
    });
    const stream = new MediaStream();
    remoteStreams.next(new Map([['presenter', stream]]));
    activePeers.next([person('presenter', 2), person('watcher', 3), person('leaver', 4)]);
    expect(component.remotePeers().find(peer => peer.peerId === 'presenter')?.stream).toBe(stream);
    remoteStreams.next(new Map([['presenter', stream]]));
    activePeers.next([person('presenter', 2), person('watcher', 3)]);
    expect(component.remotePeers().map(peer => peer.peerId)).toEqual(['presenter', 'watcher']);
    expect(component.activePeersCount()).toBe(2);
  });
});
