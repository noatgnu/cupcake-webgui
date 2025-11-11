import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionWebrtcPanel } from './session-webrtc-panel';
import { WebRTCService, WebRTCSignallingService, PeerRole, PeerConnectionState } from '@noatgnu/cupcake-mint-chocolate';
import { ToastService } from '@noatgnu/cupcake-core';
import { BehaviorSubject, Subject } from 'rxjs';

describe('SessionWebrtcPanel', () => {
  let component: SessionWebrtcPanel;
  let fixture: ComponentFixture<SessionWebrtcPanel>;
  let mockWebRTCService: jasmine.SpyObj<WebRTCService>;
  let mockSignalingService: jasmine.SpyObj<WebRTCSignallingService>;
  let mockToastService: jasmine.SpyObj<ToastService>;
  let connectionStateSubject: BehaviorSubject<string>;
  let remoteStreamsSubject: Subject<Map<string, MediaStream>>;
  let activePeersSubject: Subject<any[]>;

  beforeEach(async () => {
    connectionStateSubject = new BehaviorSubject<string>('disconnected');
    remoteStreamsSubject = new Subject<Map<string, MediaStream>>();
    activePeersSubject = new Subject<any[]>();

    mockWebRTCService = jasmine.createSpyObj('WebRTCService', [
      'startSession',
      'endSession',
      'startScreenShare',
      'stopScreenShare'
    ], {
      connectionState$: connectionStateSubject.asObservable(),
      remoteStreams$: remoteStreamsSubject.asObservable(),
      activePeers$: activePeersSubject.asObservable(),
      localMediaStream: null
    });

    mockSignalingService = jasmine.createSpyObj('WebRTCSignallingService', [
      'sendPeerState'
    ], {
      peers: []
    });

    mockToastService = jasmine.createSpyObj('ToastService', [
      'success',
      'error',
      'info'
    ]);

    await TestBed.configureTestingModule({
      imports: [SessionWebrtcPanel],
      providers: [
        { provide: WebRTCService, useValue: mockWebRTCService },
        { provide: WebRTCSignallingService, useValue: mockSignalingService },
        { provide: ToastService, useValue: mockToastService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionWebrtcPanel);
    component = fixture.componentInstance;
    component.sessionId = 'test-session-123';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.isConnected()).toBeFalse();
    expect(component.videoEnabled()).toBeTrue();
    expect(component.audioEnabled()).toBeTrue();
    expect(component.screenShareEnabled()).toBeFalse();
    expect(component.isExpanded()).toBeFalse();
    expect(component.remotePeers()).toEqual([]);
  });

  it('should connect to WebRTC session', async () => {
    mockWebRTCService.startSession.and.returnValue(Promise.resolve());

    await component.connect();

    expect(mockWebRTCService.startSession).toHaveBeenCalledWith(
      'test-session-123',
      PeerRole.PARTICIPANT,
      true,
      true
    );
    expect(mockToastService.success).toHaveBeenCalledWith('Connected to WebRTC session');
  });

  it('should handle connection error', async () => {
    const error = new Error('Connection failed');
    mockWebRTCService.startSession.and.returnValue(Promise.reject(error));

    await component.connect();

    expect(mockToastService.error).toHaveBeenCalledWith('Failed to connect to WebRTC session');
  });

  it('should disconnect from WebRTC session', () => {
    component.isConnected.set(true);
    component.remotePeers.set([{
      peerId: 'peer-1',
      userId: 1,
      username: 'Test User',
      role: PeerRole.PARTICIPANT,
      hasVideo: true,
      hasAudio: true,
      hasScreenShare: false,
      connectionState: PeerConnectionState.CONNECTED
    }]);

    component.disconnect();

    expect(mockWebRTCService.endSession).toHaveBeenCalled();
    expect(component.isConnected()).toBeFalse();
    expect(component.remotePeers()).toEqual([]);
    expect(mockToastService.info).toHaveBeenCalledWith('Disconnected from WebRTC session');
  });

  it('should update connection state from service', () => {
    expect(component.isConnected()).toBeFalse();

    connectionStateSubject.next('connected');

    expect(component.isConnected()).toBeTrue();

    connectionStateSubject.next('disconnected');

    expect(component.isConnected()).toBeFalse();
  });

  it('should toggle video track', () => {
    const mockStream = new MediaStream();
    const mockVideoTrack = jasmine.createSpyObj('MediaStreamTrack', [], { enabled: true });
    spyOn(mockStream, 'getVideoTracks').and.returnValue([mockVideoTrack as any]);
    component.localStream.set(mockStream);

    component.toggleVideo();

    expect(mockVideoTrack.enabled).toBeFalse();
    expect(component.videoEnabled()).toBeFalse();
    expect(mockSignalingService.sendPeerState).toHaveBeenCalledWith(undefined, false, undefined, undefined);
  });

  it('should toggle audio track', () => {
    const mockStream = new MediaStream();
    const mockAudioTrack = jasmine.createSpyObj('MediaStreamTrack', [], { enabled: true });
    spyOn(mockStream, 'getAudioTracks').and.returnValue([mockAudioTrack as any]);
    component.localStream.set(mockStream);

    component.toggleAudio();

    expect(mockAudioTrack.enabled).toBeFalse();
    expect(component.audioEnabled()).toBeFalse();
    expect(mockSignalingService.sendPeerState).toHaveBeenCalledWith(undefined, undefined, false, undefined);
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
    const error = new Error('Screen share failed');
    mockWebRTCService.startScreenShare.and.returnValue(Promise.reject(error));

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

  it('should update remote peers when streams change', () => {
    const mockStream = new MediaStream();
    const streamsMap = new Map<string, MediaStream>();
    streamsMap.set('peer-1', mockStream);

    mockSignalingService.peers = [{
      id: 'peer-1',
      userId: 1,
      username: 'Test User',
      peerRole: PeerRole.PARTICIPANT,
      hasVideo: true,
      hasAudio: true,
      hasScreenShare: false,
      connectionState: PeerConnectionState.CONNECTED
    }];

    remoteStreamsSubject.next(streamsMap);

    const peers = component.remotePeers();
    expect(peers.length).toBe(1);
    expect(peers[0].peerId).toBe('peer-1');
    expect(peers[0].username).toBe('Test User');
    expect(peers[0].stream).toBe(mockStream);
  });

  it('should calculate active peers count', () => {
    expect(component.activePeersCount()).toBe(0);

    component.remotePeers.set([
      {
        peerId: 'peer-1',
        userId: 1,
        username: 'User 1',
        role: PeerRole.PARTICIPANT,
        hasVideo: true,
        hasAudio: true,
        hasScreenShare: false,
        connectionState: PeerConnectionState.CONNECTED
      },
      {
        peerId: 'peer-2',
        userId: 2,
        username: 'User 2',
        role: PeerRole.PARTICIPANT,
        hasVideo: true,
        hasAudio: true,
        hasScreenShare: false,
        connectionState: PeerConnectionState.CONNECTED
      }
    ]);

    expect(component.activePeersCount()).toBe(2);
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
