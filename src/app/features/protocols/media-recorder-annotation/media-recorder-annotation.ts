import { Component, OnInit, OnDestroy, signal, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@noatgnu/cupcake-core';
import { AudioVisualizer } from '../../../shared/components/audio-visualizer/audio-visualizer';

@Component({
  selector: 'app-media-recorder-annotation',
  imports: [CommonModule, FormsModule, AudioVisualizer],
  templateUrl: './media-recorder-annotation.html',
  styleUrl: './media-recorder-annotation.scss'
})
export class MediaRecorderAnnotation implements OnInit, OnDestroy {
  private toastService = inject(ToastService);

  @Output() recordingComplete = new EventEmitter<File>();
  @Output() cancelled = new EventEmitter<void>();

  recordingType = signal<'audio' | 'video' | 'screen'>('audio');
  recording = signal(false);
  recordedBlob = signal<Blob | null>(null);
  previewUrl = signal<string | null>(null);
  enableMicrophone = signal(true);
  visualizerStream = signal<MediaStream | null>(null);

  audioDevices = signal<MediaDeviceInfo[]>([]);
  videoDevices = signal<MediaDeviceInfo[]>([]);
  selectedAudioDevice = signal<string>('');
  selectedVideoDevice = signal<string>('');

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private recordingStartTime: number | null = null;
  recordingDuration = signal(0);
  private durationInterval: any = null;

  ngOnInit(): void {
    this.enumerateDevices();
  }

  async enumerateDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');

      this.audioDevices.set(audioInputs);
      this.videoDevices.set(videoInputs);

      if (audioInputs.length > 0 && !this.selectedAudioDevice()) {
        this.selectedAudioDevice.set(audioInputs[0].deviceId);
      }
      if (videoInputs.length > 0 && !this.selectedVideoDevice()) {
        this.selectedVideoDevice.set(videoInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
      this.toastService.error('Failed to access media devices');
    }
  }

  async startRecording(): Promise<void> {
    const type = this.recordingType();

    try {
      if (type === 'audio') {
        await this.startAudioRecording();
      } else if (type === 'video') {
        await this.startVideoRecording();
      } else if (type === 'screen') {
        await this.startScreenRecording();
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      this.toastService.error('Failed to start recording');
    }
  }

  private async startAudioRecording(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: this.selectedAudioDevice() ? { deviceId: { exact: this.selectedAudioDevice() } } : true
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.visualizerStream.set(this.mediaStream);
    this.initializeMediaRecorder('audio');
  }

  private async startVideoRecording(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      video: this.selectedVideoDevice() ? { deviceId: { exact: this.selectedVideoDevice() } } : true
    };

    if (this.enableMicrophone()) {
      constraints.audio = this.selectedAudioDevice() ? { deviceId: { exact: this.selectedAudioDevice() } } : true;
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.initializeMediaRecorder('video');
  }

  private async startScreenRecording(): Promise<void> {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    const tracks = [...displayStream.getTracks()];

    if (this.enableMicrophone()) {
      const audioConstraints: MediaStreamConstraints = {
        audio: this.selectedAudioDevice() ? { deviceId: { exact: this.selectedAudioDevice() } } : true
      };

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        tracks.push(...audioStream.getAudioTracks());
      } catch (error) {
        console.warn('Could not access microphone for screen recording:', error);
      }
    }

    this.mediaStream = new MediaStream(tracks);
    this.initializeMediaRecorder('screen');
  }

  private initializeMediaRecorder(type: 'audio' | 'video' | 'screen'): void {
    if (!this.mediaStream) return;

    this.recordedChunks = [];
    this.recordedBlob.set(null);
    this.previewUrl.set(null);

    const mimeType = type === 'audio' ? 'audio/webm' : 'video/webm';
    const options: MediaRecorderOptions = { mimeType };

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.recordedBlob.set(blob);
        this.recordedChunks = [];

        const url = URL.createObjectURL(blob);
        this.previewUrl.set(url);

        this.stopDurationTimer();
        this.notifyRecordingComplete();
      };

      this.mediaRecorder.start();
      this.recording.set(true);
      this.startDurationTimer();
    } catch (error) {
      console.error('Error starting MediaRecorder:', error);
      this.toastService.error('Failed to start recording');
      this.stopMediaStream();
    }
  }

  private startDurationTimer(): void {
    this.recordingStartTime = Date.now();
    this.recordingDuration.set(0);

    this.durationInterval = setInterval(() => {
      if (this.recordingStartTime) {
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        this.recordingDuration.set(elapsed);
      }
    }, 1000);
  }

  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.recording.set(false);
    this.visualizerStream.set(null);
    this.stopMediaStream();
  }

  private stopMediaStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  private notifyRecordingComplete(): void {
    const blob = this.recordedBlob();
    if (!blob) {
      return;
    }

    const type = this.recordingType();
    const extension = 'webm';
    const filename = `recorded-${type}-${Date.now()}.${extension}`;
    const file = new File([blob], filename, { type: blob.type });

    this.recordingComplete.emit(file);
  }

  discardRecording(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }

    this.recordedBlob.set(null);
    this.previewUrl.set(null);
    this.recordingDuration.set(0);
    this.visualizerStream.set(null);
    this.recordingComplete.emit(null as any);
  }

  cancel(): void {
    this.discardRecording();
    this.stopRecording();
    this.cancelled.emit();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.stopRecording();
    this.stopDurationTimer();

    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
