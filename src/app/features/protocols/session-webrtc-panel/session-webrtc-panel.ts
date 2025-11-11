import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, computed, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import {
  WebRTCService,
  WebRTCSignallingService,
  WebRTCSessionService,
  PeerRole,
  PeerConnectionState,
  PeerInfo,
  WebRTCSessionType,
  WebRTCSessionStatus,
  WebRTCSession,
  ChatMessage,
  FileTransferProgress,
  FileOfferData
} from '@noatgnu/cupcake-mint-chocolate';
import { ToastService, AuthService } from '@noatgnu/cupcake-core';
import { SessionService } from '@noatgnu/cupcake-red-velvet';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface RemotePeer {
  peerId: string;
  userId: number;
  username: string;
  stream?: MediaStream;
  role: PeerRole;
  hasVideo: boolean;
  hasAudio: boolean;
  hasScreenShare: boolean;
  connectionState: PeerConnectionState;
}

interface DisplayChatMessage {
  peerId: string;
  username: string;
  message: string;
  timestamp: Date;
  isLocal: boolean;
  fileOffer?: FileOfferData;
}

@Component({
  selector: 'app-session-webrtc-panel',
  imports: [CommonModule, FormsModule, NgbDropdownModule],
  templateUrl: './session-webrtc-panel.html',
  styleUrl: './session-webrtc-panel.scss',
})
export class SessionWebrtcPanel implements OnInit, OnDestroy {
  @Input() ccrvSessionId!: number;
  @Input() role: PeerRole = PeerRole.PARTICIPANT;
  @Output() closePanel = new EventEmitter<void>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private destroy$ = new Subject<void>();

  isConnected = signal(false);
  localStream = signal<MediaStream | null>(null);
  remotePeers = signal<RemotePeer[]>([]);
  videoEnabled = signal(false);
  audioEnabled = signal(false);
  screenShareEnabled = signal(false);
  isExpanded = signal(false);
  showSettings = signal(false);
  showChat = signal(false);
  isCreatingSession = signal(false);

  availableVideoDevices = signal<MediaDeviceInfo[]>([]);
  availableAudioDevices = signal<MediaDeviceInfo[]>([]);
  selectedVideoDevice = signal<string>('');
  selectedAudioDevice = signal<string>('');

  chatMessages = signal<DisplayChatMessage[]>([]);
  chatInput = '';
  fileTransferProgress = signal<Map<string, FileTransferProgress>>(new Map());

  webrtcSession = signal<WebRTCSession | null>(null);
  sessionNameInput = '';
  dataChannelReady = signal(false);
  availableSessions = signal<WebRTCSession[]>([]);
  selectedSessionId = signal<string | null>(null);
  isLoadingSessions = signal(false);
  showCreateSessionModal = signal(false);
  newSessionName = '';
  isCreatingNewSession = signal(false);
  isDeletingSession = signal(false);

  connectionState = computed(() => {
    if (!this.isConnected()) return 'disconnected';
    return 'connected';
  });

  hasEditPermission = computed(() => {
    const currentUser = this.authService.getCurrentUser();
    return currentUser !== null;
  });

  activePeersCount = computed(() => this.remotePeers().length);
  canSendMessages = computed(() => this.isConnected() && this.dataChannelReady());

  constructor(
    private webrtcService: WebRTCService,
    private signalingService: WebRTCSignallingService,
    private webrtcSessionService: WebRTCSessionService,
    private sessionService: SessionService,
    private toastService: ToastService,
    private authService: AuthService
  ) {
    effect(() => {
      const stream = this.webrtcService.localMediaStream;
      this.localStream.set(stream || null);
    });
  }

  private readonly STORAGE_PREFIX = 'cupcake-vanilla-ng_webrtc';
  private readonly VIDEO_DEVICE_KEY = `${this.STORAGE_PREFIX}_video_device`;
  private readonly AUDIO_DEVICE_KEY = `${this.STORAGE_PREFIX}_audio_device`;

  private saveVideoDevicePreference(deviceId: string): void {
    try {
      localStorage.setItem(this.VIDEO_DEVICE_KEY, deviceId);
    } catch (error) {
      console.error('Failed to save video device preference:', error);
    }
  }

  private saveAudioDevicePreference(deviceId: string): void {
    try {
      localStorage.setItem(this.AUDIO_DEVICE_KEY, deviceId);
    } catch (error) {
      console.error('Failed to save audio device preference:', error);
    }
  }

  private loadVideoDevicePreference(): string | null {
    try {
      return localStorage.getItem(this.VIDEO_DEVICE_KEY);
    } catch (error) {
      console.error('Failed to load video device preference:', error);
      return null;
    }
  }

  private loadAudioDevicePreference(): string | null {
    try {
      return localStorage.getItem(this.AUDIO_DEVICE_KEY);
    } catch (error) {
      console.error('Failed to load audio device preference:', error);
      return null;
    }
  }

  ngOnInit(): void {
    this.subscribeToWebRTCEvents();
    this.enumerateDevices();
    this.loadAvailableSessions();
  }

  async loadAvailableSessions(): Promise<void> {
    try {
      this.isLoadingSessions.set(true);
      const response = await this.webrtcSessionService.getSessions({
        ccrvSessionId: this.ccrvSessionId,
        sessionStatus: WebRTCSessionStatus.ACTIVE,
        limit: 10
      }).toPromise();

      if (response && response.results) {
        this.availableSessions.set(response.results);
        console.log('Loaded available WebRTC sessions:', response.results);
      }
    } catch (error) {
      console.error('Failed to load available WebRTC sessions:', error);
    } finally {
      this.isLoadingSessions.set(false);
    }
  }

  openCreateSessionModal(): void {
    this.newSessionName = '';
    this.showCreateSessionModal.set(true);
  }

  closeCreateSessionModal(): void {
    this.showCreateSessionModal.set(false);
    this.newSessionName = '';
  }

  async createNewSession(): Promise<void> {
    if (!this.newSessionName.trim()) {
      this.toastService.error('Please enter a session name');
      return;
    }

    try {
      this.isCreatingNewSession.set(true);
      const newSession = await this.webrtcSessionService.createSession({
        name: this.newSessionName.trim(),
        sessionType: WebRTCSessionType.VIDEO_CALL,
        ccrvSessionIds: [this.ccrvSessionId]
      }).toPromise();

      if (newSession) {
        this.toastService.success('Session created successfully');
        this.closeCreateSessionModal();
        await this.loadAvailableSessions();
        this.selectedSessionId.set(newSession.id);
      }
    } catch (error) {
      console.error('Failed to create WebRTC session:', error);
      this.toastService.error('Failed to create session');
    } finally {
      this.isCreatingNewSession.set(false);
    }
  }

  async deleteSession(sessionId: string, sessionName?: string): Promise<void> {
    const confirmMessage = sessionName
      ? `Are you sure you want to delete session "${sessionName}"?`
      : 'Are you sure you want to delete this session?';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      this.isDeletingSession.set(true);
      await this.webrtcSessionService.deleteSession(sessionId).toPromise();
      this.toastService.success('Session deleted successfully');
      await this.loadAvailableSessions();

      if (this.selectedSessionId() === sessionId) {
        this.selectedSessionId.set(null);
      }
    } catch (error) {
      console.error('Failed to delete WebRTC session:', error);
      this.toastService.error('Failed to delete session');
    } finally {
      this.isDeletingSession.set(false);
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToWebRTCEvents(): void {
    this.webrtcService.connectionState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(state => {
      console.log('WebRTC connection state:', state);
      this.isConnected.set(state === 'connected' || state === 'connecting');
    });

    this.webrtcService.localStream$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(stream => {
      this.localStream.set(stream);
    });

    this.webrtcService.remoteStreams$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(streams => {
      this.updateRemotePeers(streams);
    });

    this.webrtcService.activePeers$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(peers => {
      this.updatePeerInfo(peers);
    });

    this.signalingService.connected$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(connected => {
      console.log('Signaling connected:', connected);
      if (connected) {
        this.isConnected.set(true);
      }
    });

    this.webrtcService.chatMessages$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(chatMessage => {
      this.handleIncomingChatMessage(chatMessage);
    });

    this.webrtcService.fileTransferProgress$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(progress => {
      this.fileTransferProgress.update(map => {
        const newMap = new Map(map);
        newMap.set(progress.fileId, progress);
        return newMap;
      });
    });

    this.webrtcService.dataChannelReady$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(ready => {
      console.log('Data channel ready state changed:', ready);
      this.dataChannelReady.set(ready);
    });
  }

  private handleIncomingChatMessage(chatMessage: ChatMessage): void {
    const currentUser = this.authService.getCurrentUser();
    const isLocal = currentUser?.username === chatMessage.username;

    const displayMessage: DisplayChatMessage = {
      peerId: chatMessage.peerId,
      username: chatMessage.username,
      message: chatMessage.message,
      timestamp: new Date(chatMessage.timestamp),
      isLocal: isLocal,
      fileOffer: chatMessage.fileOffer
    };

    this.chatMessages.update(messages => [...messages, displayMessage]);
  }

  private updateRemotePeers(streams: Map<string, MediaStream>): void {
    const currentPeers = this.remotePeers();
    const updatedPeers: RemotePeer[] = [];

    streams.forEach((stream, peerId) => {
      const existingPeer = currentPeers.find(p => p.peerId === peerId);
      if (existingPeer) {
        updatedPeers.push({ ...existingPeer, stream });
      } else {
        const peerInfo = this.signalingService.peers.find(p => p.id === peerId);
        if (peerInfo) {
          updatedPeers.push({
            peerId: peerInfo.id,
            userId: peerInfo.userId,
            username: peerInfo.username,
            stream,
            role: peerInfo.peerRole,
            hasVideo: peerInfo.hasVideo,
            hasAudio: peerInfo.hasAudio,
            hasScreenShare: peerInfo.hasScreenShare,
            connectionState: peerInfo.connectionState
          });
        }
      }
    });

    this.remotePeers.set(updatedPeers);
  }

  private updatePeerInfo(peers: PeerInfo[]): void {
    const currentPeers = this.remotePeers();
    const updatedPeers: RemotePeer[] = [];
    const processedPeerIds = new Set<string>();

    currentPeers.forEach(remotePeer => {
      const peerInfo = peers.find(p => p.id === remotePeer.peerId);
      if (peerInfo) {
        updatedPeers.push({
          ...remotePeer,
          hasVideo: peerInfo.hasVideo,
          hasAudio: peerInfo.hasAudio,
          hasScreenShare: peerInfo.hasScreenShare,
          connectionState: peerInfo.connectionState
        });
        processedPeerIds.add(peerInfo.id);
      } else {
        updatedPeers.push(remotePeer);
      }
    });

    peers.forEach(peerInfo => {
      if (!processedPeerIds.has(peerInfo.id)) {
        updatedPeers.push({
          peerId: peerInfo.id,
          userId: peerInfo.userId,
          username: peerInfo.username,
          stream: undefined,
          role: peerInfo.peerRole,
          hasVideo: peerInfo.hasVideo,
          hasAudio: peerInfo.hasAudio,
          hasScreenShare: peerInfo.hasScreenShare,
          connectionState: peerInfo.connectionState
        });
      }
    });

    this.remotePeers.set(updatedPeers);
  }

  async connect(): Promise<void> {
    try {
      this.isCreatingSession.set(true);

      const enableVideo = this.videoEnabled();
      const enableAudio = this.audioEnabled();

      console.log('Connect attempt:', {
        videoEnabled: this.videoEnabled(),
        audioEnabled: this.audioEnabled(),
        selectedVideoDevice: this.selectedVideoDevice(),
        selectedAudioDevice: this.selectedAudioDevice(),
        enableVideo,
        enableAudio,
        ccrvSessionId: this.ccrvSessionId,
        selectedSessionId: this.selectedSessionId()
      });

      let session: WebRTCSession;

      if (this.selectedSessionId()) {
        const existingSession = this.availableSessions().find(s => s.id === this.selectedSessionId());
        if (existingSession) {
          session = existingSession;
          console.log('Joining existing WebRTC session:', session);
        } else {
          throw new Error('Selected session not found');
        }
      } else {
        session = await this.sessionService.joinDefaultWebRTC(this.ccrvSessionId).toPromise();
        if (!session) {
          throw new Error('Failed to join WebRTC session');
        }
        console.log('Joined default WebRTC session:', session);
      }

      this.webrtcSession.set(session);

      await this.webrtcService.startSession(
        session.id,
        this.role,
        enableVideo,
        enableAudio,
        enableVideo ? (this.selectedVideoDevice() || undefined) : undefined,
        enableAudio ? (this.selectedAudioDevice() || undefined) : undefined
      );

      this.isCreatingSession.set(false);
      this.toastService.success('Connected to WebRTC session');
    } catch (error) {
      console.error('Failed to connect to WebRTC session:', error);
      this.isCreatingSession.set(false);
      this.toastService.error('Failed to connect to WebRTC session');
    }
  }

  disconnect(): void {
    this.webrtcService.endSession();
    this.isConnected.set(false);
    this.remotePeers.set([]);
    this.webrtcSession.set(null);

    this.toastService.info('Disconnected from WebRTC session');
  }

  async toggleVideo(): Promise<void> {
    const isEnabling = !this.videoEnabled();
    this.videoEnabled.set(isEnabling);

    if (this.isConnected()) {
      try {
        if (isEnabling) {
          await this.webrtcService.enableVideo(this.selectedVideoDevice() || undefined);
        } else {
          await this.webrtcService.disableVideo();
        }
      } catch (error) {
        console.error('Failed to toggle video:', error);
        this.videoEnabled.set(!isEnabling);
        this.toastService.error('Failed to toggle video');
      }
    }
  }

  async toggleAudio(): Promise<void> {
    const isEnabling = !this.audioEnabled();
    this.audioEnabled.set(isEnabling);

    if (this.isConnected()) {
      try {
        if (isEnabling) {
          await this.webrtcService.enableAudio(this.selectedAudioDevice() || undefined);
        } else {
          await this.webrtcService.disableAudio();
        }
      } catch (error) {
        console.error('Failed to toggle audio:', error);
        this.audioEnabled.set(!isEnabling);
        this.toastService.error('Failed to toggle audio');
      }
    }
  }

  async toggleScreenShare(): Promise<void> {
    if (this.screenShareEnabled()) {
      this.webrtcService.stopScreenShare();
      this.screenShareEnabled.set(false);
      this.signalingService.sendPeerState(undefined, undefined, undefined, false);
      this.toastService.info('Screen sharing stopped');
    } else {
      try {
        await this.webrtcService.startScreenShare();
        this.screenShareEnabled.set(true);
        this.signalingService.sendPeerState(undefined, undefined, undefined, true);
        this.toastService.success('Screen sharing started');
      } catch (error) {
        console.error('Failed to start screen sharing:', error);
        this.toastService.error('Failed to start screen sharing');
      }
    }
  }

  toggleExpand(): void {
    this.isExpanded.set(!this.isExpanded());
  }

  close(): void {
    this.closePanel.emit();
  }

  toggleSettings(): void {
    const wasShown = this.showSettings();
    this.showSettings.update(show => !show);
    if (!wasShown) {
      this.showChat.set(false);
      const session = this.webrtcSession();
      if (session) {
        this.sessionNameInput = session.name || '';
      }
    }
  }

  toggleChat(): void {
    const wasShown = this.showChat();
    this.showChat.update(show => !show);
    if (!wasShown) {
      this.showSettings.set(false);
    }
  }

  sendChatMessage(): void {
    const message = this.chatInput.trim();
    if (!message || !this.isConnected()) return;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    this.webrtcService.sendChatMessage(message);
    this.chatInput = '';
  }

  openFileSelector(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.webrtcService.offerFile(file);
    input.value = '';
  }

  downloadFile(fileId: string): void {
    this.webrtcService.requestFile(fileId);
  }

  getFileProgress(fileId: string): FileTransferProgress | undefined {
    return this.fileTransferProgress().get(fileId);
  }

  async enumerateDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');

      this.availableVideoDevices.set(videoDevices);
      this.availableAudioDevices.set(audioDevices);

      const savedVideoDevice = this.loadVideoDevicePreference();
      if (savedVideoDevice && videoDevices.some(d => d.deviceId === savedVideoDevice)) {
        this.selectedVideoDevice.set(savedVideoDevice);
        console.log('Loaded saved video device:', savedVideoDevice);
      } else if (videoDevices.length > 0) {
        this.selectedVideoDevice.set(videoDevices[0].deviceId);
      }

      const savedAudioDevice = this.loadAudioDevicePreference();
      if (savedAudioDevice && audioDevices.some(d => d.deviceId === savedAudioDevice)) {
        this.selectedAudioDevice.set(savedAudioDevice);
        console.log('Loaded saved audio device:', savedAudioDevice);
      } else if (audioDevices.length > 0) {
        this.selectedAudioDevice.set(audioDevices[0].deviceId);
      }

      console.log('Devices enumerated:', {
        videoDevices: videoDevices.length,
        audioDevices: audioDevices.length
      });
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      this.toastService.error('Failed to enumerate media devices');
      this.videoEnabled.set(false);
      this.audioEnabled.set(false);
    }
  }

  async changeVideoDevice(deviceId: string): Promise<void> {
    this.selectedVideoDevice.set(deviceId);
    this.saveVideoDevicePreference(deviceId);

    if (this.isConnected() && this.videoEnabled()) {
      if (deviceId) {
        await this.switchVideoDevice(deviceId);
      } else {
        await this.webrtcService.disableVideo();
        this.videoEnabled.set(false);
      }
    }
  }

  async changeAudioDevice(deviceId: string): Promise<void> {
    this.selectedAudioDevice.set(deviceId);
    this.saveAudioDevicePreference(deviceId);

    if (this.isConnected() && this.audioEnabled()) {
      if (deviceId) {
        await this.switchAudioDevice(deviceId);
      } else {
        await this.webrtcService.disableAudio();
        this.audioEnabled.set(false);
      }
    }
  }

  private stopVideo(): void {
    const stream = this.localStream();
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        stream.removeTrack(videoTrack);
        this.videoEnabled.set(false);
      }
    }
  }

  private stopAudio(): void {
    const stream = this.localStream();
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.stop();
        stream.removeTrack(audioTrack);
        this.audioEnabled.set(false);
      }
    }
  }

  private async switchVideoDevice(deviceId: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    try {
      console.log('Switching video device to:', deviceId);
      await this.webrtcService.switchVideoDevice(deviceId);
      this.toastService.success('Video device changed');
    } catch (error) {
      console.error('Failed to switch video device:', error);
      this.toastService.error('Failed to switch video device');
    }
  }

  private async switchAudioDevice(deviceId: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    try {
      console.log('Switching audio device to:', deviceId);
      await this.webrtcService.switchAudioDevice(deviceId);
      this.toastService.success('Audio device changed');
    } catch (error) {
      console.error('Failed to switch audio device:', error);
      this.toastService.error('Failed to switch audio device');
    }
  }

  getVideoElement(peerId: string): HTMLVideoElement | null {
    return document.getElementById(`remote-video-${peerId}`) as HTMLVideoElement;
  }

  attachStreamToVideo(peerId: string, stream: MediaStream): void {
    setTimeout(() => {
      const videoElement = this.getVideoElement(peerId);
      if (videoElement && videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
    }, 100);
  }

  async saveSessionName(): Promise<void> {
    const session = this.webrtcSession();
    if (!session) {
      return;
    }

    const newName = this.sessionNameInput.trim() || null;
    const currentName = session.name || null;

    if (newName === currentName) {
      return;
    }

    try {
      const updatedSession = await this.webrtcSessionService.updateSession(
        session.id,
        { name: newName || undefined }
      ).toPromise();

      if (updatedSession) {
        this.webrtcSession.set(updatedSession);
        if (newName) {
          this.toastService.success('Session name updated');
        } else {
          this.toastService.success('Session set as default');
        }
      }
    } catch (error) {
      console.error('Failed to update session name:', error);
      this.toastService.error('Failed to update session name');
    }
  }

  async setAsDefaultSession(): Promise<void> {
    const session = this.webrtcSession();
    if (!session) {
      return;
    }

    try {
      const updatedSession = await this.webrtcSessionService.updateSession(
        session.id,
        { isDefault: true }
      ).toPromise();

      if (updatedSession) {
        this.webrtcSession.set(updatedSession);
        this.toastService.success('Session set as default');
      }
    } catch (error) {
      console.error('Failed to set session as default:', error);
      this.toastService.error('Failed to set session as default');
    }
  }
}
