import { Component, inject, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SessionService, ProtocolService, ProtocolSectionService, ProtocolStepService, StepReagentService, StepAnnotationService, TimeKeeperService, AnnotationChunkedUploadService, CCRVNotificationWebSocketService } from '@noatgnu/cupcake-red-velvet';
import type { Session, ProtocolModel, ProtocolSection, ProtocolStep, StepReagent, StepAnnotation, TimeKeeper, TranscriptionStartedEvent, TranscriptionCompletedEvent, TranscriptionFailedEvent } from '@noatgnu/cupcake-red-velvet';
import { InstrumentUsageService, InstrumentUsageCreateRequest, InstrumentUsage, ReagentActionService, ReagentAction, InstrumentService, ReagentService } from '@noatgnu/cupcake-macaron';
import { ToastService, AuthService, AnnotationType, AsyncTaskStatus, TaskType, SiteConfigService } from '@noatgnu/cupcake-core';
import type { SiteConfig } from '@noatgnu/cupcake-core';
import { MetadataTable, MetadataColumn, Websocket as CCVWebSocketService } from '@noatgnu/cupcake-vanilla';
import { DurationFormatPipe } from '../../../shared/pipes/duration-format-pipe';
import { StepTemplatePipe } from '../../../shared/pipes/step-template-pipe';
import { TimerService } from '../../../shared/services/timer';
import { AnnotationModal } from '../annotation-modal/annotation-modal';
import { WebvttEditor } from '../webvtt-editor/webvtt-editor';
import { SessionWebrtcPanel } from '../session-webrtc-panel/session-webrtc-panel';
import { PeerRole } from '@noatgnu/cupcake-mint-chocolate';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

interface CalculatorHistoryData {
  history: any[];
}

interface MolarityHistoryData {
  history: any[];
}

@Component({
  selector: 'app-session-detail',
  imports: [CommonModule, FormsModule, RouterLink, DurationFormatPipe, StepTemplatePipe, WebvttEditor, SessionWebrtcPanel],
  templateUrl: './session-detail.html',
  styleUrl: './session-detail.scss'
})
export class SessionDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modalService = inject(NgbModal);
  private sessionService = inject(SessionService);
  private protocolService = inject(ProtocolService);
  private sectionService = inject(ProtocolSectionService);
  private stepService = inject(ProtocolStepService);
  private stepReagentService = inject(StepReagentService);
  private stepAnnotationService = inject(StepAnnotationService);
  private instrumentUsageService = inject(InstrumentUsageService);
  private instrumentService = inject(InstrumentService);
  private reagentActionService = inject(ReagentActionService);
  private reagentService = inject(ReagentService);
  private timeKeeperService = inject(TimeKeeperService);
  private annotationUploadService = inject(AnnotationChunkedUploadService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private siteConfigService = inject(SiteConfigService);
  private notificationWs = inject(CCRVNotificationWebSocketService);
  private ccvWsService = inject(CCVWebSocketService);
  public timer = inject(TimerService);

  private destroy$ = new Subject<void>();

  readonly Math = Math;
  readonly AnnotationType = AnnotationType;
  readonly PeerRole = PeerRole;

  siteConfig = signal<SiteConfig | null>(null);
  session = signal<Session | null>(null);
  protocols = signal<ProtocolModel[]>([]);
  selectedProtocolIndex = signal(0);

  webrtcRole = computed(() => {
    const currentSession = this.session();
    const currentUser = this.authService.getCurrentUser();

    if (!currentSession || !currentUser) {
      return PeerRole.PARTICIPANT;
    }

    if (currentUser.isSuperuser || currentUser.isStaff) {
      return PeerRole.HOST;
    }

    if (currentSession.owner === currentUser.id) {
      return PeerRole.HOST;
    }

    if (currentSession.editors && currentSession.editors.includes(currentUser.id)) {
      return PeerRole.HOST;
    }

    return PeerRole.PARTICIPANT;
  });
  sections = signal<ProtocolSection[]>([]);
  selectedSectionIndex = signal(0);
  steps = signal<Map<number, ProtocolStep[]>>(new Map());
  currentStepIndex = signal(0);
  stepReagents = signal<Map<number, StepReagent[]>>(new Map());
  reagentActions = signal<Map<number, ReagentAction[]>>(new Map());
  stepAnnotations = signal<StepAnnotation[]>([]);
  currentAnnotationIndex = signal(0);
  annotationsLimit = signal(10);
  annotationsOffset = signal(0);
  annotationsTotal = signal(0);
  hideScratched = signal(false);
  annotationDisplayMode = signal<'single' | 'list'>('list');
  bookingDataCache = signal<Map<number, InstrumentUsage>>(new Map());
  metadataTableCache = signal<Map<number, MetadataTable>>(new Map());
  reagentMetadataCache = signal<Map<number, MetadataTable>>(new Map());
  storedReagentCache = signal<Map<number, any>>(new Map());
  mediaCurrentTimes = signal<Map<number, number>>(new Map());
  transcribingAnnotations = signal<Set<number>>(new Set());
  loadingBookings = signal<Set<number>>(new Set());
  loadingInstrumentMetadata = signal<Set<number>>(new Set());
  loadingReagentMetadata = signal<Set<number>>(new Set());

  loading = signal(false);
  loadingSections = signal(false);
  loadingSteps = signal(false);
  loadingAnnotations = signal(false);

  uploading = signal(false);
  uploadProgress = signal(0);

  showWebRTC = signal(false);

  webrtcFeatureEnabled = computed(() => {
    const config = this.siteConfig();
    return config?.uiFeatures?.show_webrtc !== false;
  });

  transcriptionStatus = signal<Map<number, 'started' | 'completed' | 'failed'>>(new Map());
  transcriptionProgress = signal<Map<number, { percentage: number; description: string }>>(new Map());

  selectedProtocol = computed(() => {
    const index = this.selectedProtocolIndex();
    const protocolsList = this.protocols();
    return index >= 0 && index < protocolsList.length ? protocolsList[index] : null;
  });

  selectedSection = computed(() => {
    const index = this.selectedSectionIndex();
    const sectionsList = this.sections();
    return index >= 0 && index < sectionsList.length ? sectionsList[index] : null;
  });

  currentSectionSteps = computed(() => {
    const section = this.selectedSection();
    if (!section) return [];
    return this.steps().get(section.id) || [];
  });

  currentStepIndexInSection = computed(() => {
    const step = this.currentStep();
    const sectionSteps = this.currentSectionSteps();
    if (!step || sectionSteps.length === 0) return -1;
    return sectionSteps.findIndex(s => s.id === step.id);
  });

  allSteps = computed(() => {
    const sectionsList = this.sections();
    const stepsMap = this.steps();
    const allStepsArray: ProtocolStep[] = [];

    sectionsList.forEach(section => {
      const sectionSteps = stepsMap.get(section.id) || [];
      allStepsArray.push(...sectionSteps);
    });

    return allStepsArray;
  });

  currentStep = computed(() => {
    const steps = this.allSteps();
    const index = this.currentStepIndex();
    return index >= 0 && index < steps.length ? steps[index] : null;
  });

  currentStepReagents = computed(() => {
    const step = this.currentStep();
    if (!step) return [];
    return this.stepReagents().get(step.id) || [];
  });

  currentStepReagentActions = computed(() => {
    const step = this.currentStep();
    if (!step) return [];
    return this.reagentActions().get(step.id) || [];
  });

  currentStepAnnotations = computed(() => {
    const step = this.currentStep();
    if (!step) return [];
    return this.stepAnnotations().filter(sa => sa.step === step.id);
  });

  currentAnnotation = computed(() => {
    const stepAnns = this.currentStepAnnotations();
    const index = this.currentAnnotationIndex();
    if (stepAnns.length === 0 || index < 0 || index >= stepAnns.length) return null;
    return stepAnns[index];
  });

  currentAnnotationDetails = computed(() => {
    return this.currentAnnotation();
  });

  canDeleteAnnotations = computed(() => {
    const currentSession = this.session();
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser || !currentSession) return false;

    if (currentUser.isSuperuser) return true;

    if (currentSession.owner === currentUser.id) return true;

    if (currentSession.editors?.includes(currentUser.id)) return true;

    return false;
  });

  currentTranscriptionStatus = computed(() => {
    const ann = this.currentAnnotation();
    if (!ann || !ann.annotation) return null;
    return this.transcriptionStatus().get(ann.annotation) || null;
  });

  ngOnInit(): void {
    this.siteConfigService.config$.pipe(takeUntil(this.destroy$)).subscribe(config => {
      this.siteConfig.set(config);
    });

    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.toastService.error('Invalid session ID');
      this.router.navigate(['/protocols/sessions']);
      return;
    }

    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      this.loadSession(numericId);
    } else {
      this.loadSessionByUniqueId(id);
    }

    this.connectToNotificationWebSocket();
    this.setupTranscriptionListeners();

    const annotationId = this.route.snapshot.queryParamMap.get('annotationId');
    if (annotationId) {
      const numericAnnotationId = parseInt(annotationId, 10);
      if (!isNaN(numericAnnotationId)) {
        this.navigateToAnnotation(numericAnnotationId);
      }
    }
  }

  connectToNotificationWebSocket(): void {
    const token = this.authService.getAccessToken();
    if (token && environment.websocketUrl) {
      this.notificationWs.connect(environment.websocketUrl, token);
    }
  }

  setupTranscriptionListeners(): void {
    this.notificationWs.transcriptionStarted$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        const statusMap = new Map(this.transcriptionStatus());
        statusMap.set(event.annotation_id, 'started');
        this.transcriptionStatus.set(statusMap);

        const transcribing = this.transcribingAnnotations();
        transcribing.add(event.annotation_id);
        this.transcribingAnnotations.set(new Set(transcribing));

        this.toastService.info(`Transcription started for annotation`);
      });

    this.notificationWs.transcriptionCompleted$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        const statusMap = new Map(this.transcriptionStatus());
        statusMap.set(event.annotation_id, 'completed');
        this.transcriptionStatus.set(statusMap);

        const transcribing = this.transcribingAnnotations();
        transcribing.delete(event.annotation_id);
        this.transcribingAnnotations.set(new Set(transcribing));

        const progress = this.transcriptionProgress();
        progress.delete(event.annotation_id);
        this.transcriptionProgress.set(new Map(progress));

        const message = event.has_translation
          ? `Transcription and translation completed`
          : `Transcription completed`;
        this.toastService.success(message);

        this.refreshAnnotationById(event.annotation_id);
      });

    this.notificationWs.transcriptionFailed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        const statusMap = new Map(this.transcriptionStatus());
        statusMap.set(event.annotation_id, 'failed');
        this.transcriptionStatus.set(statusMap);

        const transcribing = this.transcribingAnnotations();
        transcribing.delete(event.annotation_id);
        this.transcribingAnnotations.set(new Set(transcribing));

        const progress = this.transcriptionProgress();
        progress.delete(event.annotation_id);
        this.transcriptionProgress.set(new Map(progress));

        this.toastService.error(`Transcription failed: ${event.error}`);
      });

    this.ccvWsService.filterMessages('async_task.update')
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        this.handleAsyncTaskUpdate(message);
      });
  }

  private handleAsyncTaskUpdate(message: any): void {
    const task = message as AsyncTaskStatus;

    if (!task || !task.result || !task.result.annotation_id) return;

    if (task.taskType !== TaskType.TRANSCRIBE_AUDIO && task.taskType !== TaskType.TRANSCRIBE_VIDEO) {
      return;
    }

    const annotationId = task.result.annotation_id;
    const stepAnns = this.stepAnnotations();
    const stepAnn = stepAnns.find(sa => sa.annotation === annotationId);

    if (stepAnn) {
      const progress = this.transcriptionProgress();
      progress.set(annotationId, {
        percentage: task.progressPercentage || 0,
        description: task.progressDescription || ''
      });
      this.transcriptionProgress.set(new Map(progress));
    }
  }

  refreshAnnotationById(annotationId: number): void {
    const stepAnns = this.stepAnnotations();
    const stepAnn = stepAnns.find(sa => sa.annotation === annotationId);

    if (stepAnn) {
      this.stepAnnotationService.getStepAnnotation(stepAnn.id).subscribe({
        next: (updatedStepAnnotation) => {
          const updated = stepAnns.map(sa =>
            sa.id === updatedStepAnnotation.id ? updatedStepAnnotation : sa
          );
          this.stepAnnotations.set(updated);
        },
        error: (err) => {
          console.error('Failed to refresh step annotation:', err);
        }
      });
    }
  }

  navigateToAnnotation(stepAnnotationId: number): void {
    this.stepAnnotationService.getStepAnnotation(stepAnnotationId).subscribe({
      next: (annotation: StepAnnotation) => {
        this.stepService.getProtocolStep(annotation.step).subscribe({
          next: (step: ProtocolStep) => {
            const allStepsList = this.allSteps();
            const stepIndex = allStepsList.findIndex(s => s.id === step.id);

            if (stepIndex === -1) {
              this.toastService.error('This annotation belongs to a step not in this session');
              return;
            }

            this.updateSelectedSectionByStep(step);
            this.currentStepIndex.set(stepIndex);

            this.annotationDisplayMode.set('single');

            const params: any = {
              session: annotation.session,
              step: annotation.step,
              ordering: '-created_at'
            };

            if (this.hideScratched()) {
              params.scratched = false;
            }

            this.stepAnnotationService.getStepAnnotations(params).subscribe({
              next: (response) => {
                const index = response.results.findIndex(a => a.id === stepAnnotationId);
                if (index !== -1) {
                  this.annotationsOffset.set(index);
                  this.annotationsLimit.set(1);
                  this.loadStepAnnotations();
                } else {
                  this.toastService.error('Annotation not found in current filters');
                  this.annotationsOffset.set(0);
                  this.annotationsLimit.set(1);
                  this.loadStepAnnotations();
                }
              },
              error: (err: any) => {
                console.error('Error finding annotation index:', err);
                this.toastService.error('Failed to navigate to annotation');
                this.annotationsOffset.set(0);
                this.annotationsLimit.set(1);
                this.loadStepAnnotations();
              }
            });
          },
          error: (err: any) => {
            console.error('Error loading step details:', err);
            this.toastService.error('Failed to load step details');
          }
        });
      },
      error: (err: any) => {
        console.error('Error loading annotation:', err);
        this.toastService.error('Failed to load annotation');
      }
    });
  }

  loadSession(id: number): void {
    this.loading.set(true);
    this.sessionService.getSession(id).subscribe({
      next: (session) => {
        this.session.set(session);
        if (session.protocols && session.protocols.length > 0) {
          this.loadProtocols(session.protocols);
        } else {
          this.loading.set(false);
          this.toastService.error('No protocols associated with this session');
        }
      },
      error: (err) => {
        this.toastService.error('Failed to load session');
        console.error('Error loading session:', err);
        this.router.navigate(['/protocols/sessions']);
      }
    });
  }

  loadSessionByUniqueId(uniqueId: string): void {
    this.loading.set(true);
    this.sessionService.getSessions({ uniqueId: uniqueId, limit: 1 }).subscribe({
      next: (response) => {
        if (response.results.length > 0) {
          const session = response.results[0];
          this.session.set(session);
          if (session.protocols && session.protocols.length > 0) {
            this.loadProtocols(session.protocols);
          } else {
            this.loading.set(false);
            this.toastService.error('No protocols associated with this session');
          }
        } else {
          this.toastService.error('Session not found');
          this.router.navigate(['/protocols/sessions']);
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.toastService.error('Failed to load session');
        console.error('Error loading session:', err);
        this.router.navigate(['/protocols/sessions']);
        this.loading.set(false);
      }
    });
  }

  loadProtocols(protocolIds: number[]): void {
    const protocolRequests = protocolIds.map(id =>
      this.protocolService.getProtocol(id)
    );

    Promise.all(protocolRequests.map(req => req.toPromise()))
      .then(protocols => {
        const validProtocols = protocols.filter((p): p is ProtocolModel => p !== undefined);
        this.protocols.set(validProtocols);
        this.loading.set(false);

        if (validProtocols.length > 0) {
          this.selectProtocol(0);
        }
      })
      .catch(err => {
        console.error('Error loading protocols:', err);
        this.toastService.error('Failed to load protocols');
        this.loading.set(false);
      });
  }

  selectProtocol(index: number): void {
    this.selectedProtocolIndex.set(index);
    const protocol = this.protocols()[index];

    if (protocol) {
      this.loadSections(protocol.id);
    }
  }

  loadSections(protocolId: number): void {
    this.loadingSections.set(true);
    this.sectionService.getProtocolSections({ protocol: protocolId, ordering: 'order' }).subscribe({
      next: (response) => {
        this.sections.set(response.results);
        this.loadingSections.set(false);

        if (response.results.length > 0) {
          this.loadAllSteps(response.results);
        }
      },
      error: (err) => {
        this.toastService.error('Failed to load sections');
        console.error('Error loading sections:', err);
        this.loadingSections.set(false);
      }
    });
  }

  loadAllSteps(sections: ProtocolSection[]): void {
    this.loadingSteps.set(true);
    const stepRequests = sections.map(section =>
      this.stepService.getProtocolSteps({
        stepSection: section.id,
        ordering: 'order'
      }).toPromise()
    );

    Promise.all(stepRequests)
      .then(responses => {
        const stepsMap = new Map<number, ProtocolStep[]>();
        responses.forEach((response, index) => {
          if (response) {
            stepsMap.set(sections[index].id, response.results);
            response.results.forEach(step => {
              this.loadStepReagents(step.id);
              this.loadReagentActions(step.id);
            });
          }
        });
        this.steps.set(stepsMap);
        this.loadingSteps.set(false);
        this.currentStepIndex.set(0);

        const firstStep = this.currentStep();
        if (firstStep) {
          this.updateSelectedSectionByStep(firstStep);
        }

        this.initializeTimers();
        this.loadTimersFromBackend();
        this.loadStepAnnotations();
      })
      .catch(err => {
        console.error('Error loading steps:', err);
        this.toastService.error('Failed to load steps');
        this.loadingSteps.set(false);
      });
  }

  loadStepReagents(stepId: number): void {
    this.stepReagentService.getReagentsByStep(stepId).subscribe({
      next: (response) => {
        const reagentsMap = new Map(this.stepReagents());
        reagentsMap.set(stepId, response.results);
        this.stepReagents.set(reagentsMap);
      },
      error: (err) => {
        console.error('Error loading step reagents:', err);
      }
    });
  }

  loadReagentActions(stepId: number): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    this.reagentActionService.getReagentActions({ step: stepId, session: sessionId, limit: 100 }).subscribe({
      next: (response) => {
        const actionsMap = new Map(this.reagentActions());
        actionsMap.set(stepId, response.results);
        this.reagentActions.set(actionsMap);

        response.results.forEach(action => {
          if (action.reagent) {
            this.loadStoredReagentMetadata(action.reagent);
            this.loadStoredReagent(action.reagent);
          }
        });
      },
      error: (err) => {
        console.error('Error loading reagent actions:', err);
      }
    });
  }

  async openReagentBookingModal(stepReagent: StepReagent): Promise<void> {
    const currentSession = this.session();
    const step = this.currentStep();
    if (!currentSession || !step) return;

    const { ReagentBookingModal } = await import('../reagent-booking-modal/reagent-booking-modal');

    const modalRef = this.modalService.open(ReagentBookingModal, {
      size: 'lg',
      backdrop: 'static'
    });

    modalRef.componentInstance.stepReagent = stepReagent;
    modalRef.componentInstance.sessionId = currentSession.id;
    modalRef.componentInstance.stepId = step.id;

    modalRef.result.then(
      (action: ReagentAction) => {
        this.loadReagentActions(step.id);
        this.toastService.success('Reagent booked successfully');
      },
      () => {}
    );
  }

  deleteReagentAction(action: ReagentAction): void {
    if (!action.isDeletable) {
      this.toastService.error('This reagent booking can no longer be deleted (outside deletion window)');
      return;
    }

    if (!confirm('Are you sure you want to delete this reagent booking?')) {
      return;
    }

    this.reagentActionService.deleteReagentAction(action.id).subscribe({
      next: () => {
        const step = this.currentStep();
        if (step) {
          this.loadReagentActions(step.id);
        }
        this.toastService.success('Reagent booking deleted');
      },
      error: (err) => {
        console.error('Error deleting reagent action:', err);
        const errorMsg = err.error?.detail || err.error?.message || 'Failed to delete reagent booking';
        this.toastService.error(errorMsg);
      }
    });
  }

  updateSelectedSectionByStep(step: ProtocolStep): void {
    const sectionsList = this.sections();
    const stepSectionId = step.stepSection ? parseInt(step.stepSection, 10) : null;
    const sectionIndex = sectionsList.findIndex(s => s.id === stepSectionId);
    if (sectionIndex >= 0) {
      this.selectedSectionIndex.set(sectionIndex);
    }
  }

  selectSection(index: number): void {
    this.selectedSectionIndex.set(index);
    const section = this.sections()[index];

    if (section) {
      const allStepsList = this.allSteps();
      const sectionSteps = this.steps().get(section.id) || [];
      if (sectionSteps.length > 0) {
        const firstStepOfSection = sectionSteps[0];
        const stepIndex = allStepsList.findIndex(s => s.id === firstStepOfSection.id);
        if (stepIndex >= 0) {
          this.currentStepIndex.set(stepIndex);
        }
      }
    }
  }

  nextStep(): void {
    const steps = this.allSteps();
    const currentIndex = this.currentStepIndex();

    if (currentIndex < steps.length - 1) {
      this.currentStepIndex.set(currentIndex + 1);
      const newStep = this.currentStep();
      if (newStep) {
        this.updateSelectedSectionByStep(newStep);
        this.currentAnnotationIndex.set(0);
      }
    }
  }

  previousStep(): void {
    const currentIndex = this.currentStepIndex();

    if (currentIndex > 0) {
      this.currentStepIndex.set(currentIndex - 1);
      const newStep = this.currentStep();
      if (newStep) {
        this.updateSelectedSectionByStep(newStep);
        this.currentAnnotationIndex.set(0);
      }
    }
  }

  backToList(): void {
    this.router.navigate(['/protocols/sessions']);
  }

  startSession(): void {
    const currentSession = this.session();
    if (!currentSession) return;

    this.sessionService.startSession(currentSession.id).subscribe({
      next: (updated) => {
        this.session.set(updated);
        this.toastService.success('Session started successfully');
      },
      error: (err) => {
        this.toastService.error('Failed to start session');
        console.error('Error starting session:', err);
      }
    });
  }

  endSession(): void {
    const currentSession = this.session();
    if (!currentSession) return;

    if (!confirm('Are you sure you want to end this session? This action marks the session as completed.')) {
      return;
    }

    this.sessionService.endSession(currentSession.id).subscribe({
      next: (updated) => {
        this.session.set(updated);
        this.toastService.success('Session ended successfully');
      },
      error: (err) => {
        this.toastService.error('Failed to end session');
        console.error('Error ending session:', err);
      }
    });
  }

  loadStepAnnotations(): void {
    const currentSession = this.session();
    if (!currentSession) return;

    this.loadingAnnotations.set(true);
    const params: any = {
      ordering: '-created_at',
      limit: this.annotationsLimit(),
      offset: this.annotationsOffset()
    };

    if (this.hideScratched()) {
      params.scratched = false;
    }

    this.stepAnnotationService.getAnnotationsForSession(currentSession.id, params).subscribe({
      next: (response) => {
        const allStepsList = this.allSteps();
        const validStepIds = new Set(allStepsList.map(s => s.id));

        const filteredResults = response.results.filter(annotation =>
          validStepIds.has(annotation.step)
        );

        const filteredCount = Math.floor(response.count * (filteredResults.length / Math.max(response.results.length, 1)));

        this.stepAnnotations.set(filteredResults);
        this.annotationsTotal.set(filteredCount);
        this.loadingAnnotations.set(false);
        this.currentAnnotationIndex.set(0);

        filteredResults.forEach(annotation => {
          if (annotation.annotationType === AnnotationType.Booking && annotation.instrumentUsageIds) {
            annotation.instrumentUsageIds.forEach(usageId => {
              this.loadBookingData(usageId);
            });
          }
        });
      },
      error: (err) => {
        console.error('Error loading step annotations:', err);
        this.loadingAnnotations.set(false);
      }
    });
  }

  toggleHideScratched(): void {
    this.hideScratched.update(v => !v);
    this.annotationsOffset.set(0);
    this.loadStepAnnotations();
  }

  nextAnnotationsPage(): void {
    const newOffset = this.annotationsOffset() + this.annotationsLimit();
    if (newOffset < this.annotationsTotal()) {
      this.annotationsOffset.set(newOffset);
      this.loadStepAnnotations();
    }
  }

  previousAnnotationsPage(): void {
    const newOffset = Math.max(0, this.annotationsOffset() - this.annotationsLimit());
    this.annotationsOffset.set(newOffset);
    this.loadStepAnnotations();
  }

  goToAnnotationsPage(page: number): void {
    const newOffset = (page - 1) * this.annotationsLimit();
    this.annotationsOffset.set(newOffset);
    this.loadStepAnnotations();
  }

  toggleAnnotationDisplayMode(): void {
    const newMode = this.annotationDisplayMode() === 'single' ? 'list' : 'single';
    this.annotationDisplayMode.set(newMode);
    if (newMode === 'single') {
      this.currentAnnotationIndex.set(0);
      this.annotationsLimit.set(1);
      this.annotationsOffset.set(0);
      this.loadStepAnnotations();
    } else {
      this.currentAnnotationIndex.set(0);
      this.annotationsLimit.set(10);
      this.annotationsOffset.set(0);
      this.loadStepAnnotations();
    }
  }

  nextAnnotation(): void {
    if (this.annotationDisplayMode() === 'single') {
      if (this.annotationsOffset() + 1 < this.annotationsTotal()) {
        this.annotationsOffset.set(this.annotationsOffset() + 1);
        this.loadStepAnnotations();
      }
    } else {
      const stepAnns = this.currentStepAnnotations();
      const currentIndex = this.currentAnnotationIndex();
      if (currentIndex < stepAnns.length - 1) {
        this.currentAnnotationIndex.set(currentIndex + 1);
      }
    }
  }

  previousAnnotation(): void {
    if (this.annotationDisplayMode() === 'single') {
      if (this.annotationsOffset() > 0) {
        this.annotationsOffset.set(this.annotationsOffset() - 1);
        this.loadStepAnnotations();
      }
    } else {
      const currentIndex = this.currentAnnotationIndex();
      if (currentIndex > 0) {
        this.currentAnnotationIndex.set(currentIndex - 1);
      }
    }
  }

  getAnnotationTypeLabel(type: string | undefined): string {
    if (!type) return 'Note';

    switch(type.toLowerCase()) {
      case 'image':
        return 'Image';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'document':
        return 'Document';
      case 'text':
        return 'Text Note';
      default:
        return type;
    }
  }

  getAnnotationTypeIcon(type: string | undefined): string {
    if (!type) return 'bi-sticky';

    switch(type.toLowerCase()) {
      case 'image':
        return 'bi-image';
      case 'video':
        return 'bi-camera-video';
      case 'audio':
        return 'bi-mic';
      case 'document':
        return 'bi-file-earmark-text';
      case 'text':
        return 'bi-sticky';
      default:
        return 'bi-paperclip';
    }
  }

  initializeTimers(): void {
    const steps = this.allSteps();
    steps.forEach(step => {
      if (step.stepDuration) {
        this.timer.initializeTimer(step.id, step.stepDuration);
      }
    });
  }

  loadTimersFromBackend(): void {
    const currentSession = this.session();
    if (!currentSession) return;

    this.timeKeeperService.getTimeKeepersBySession(currentSession.id).subscribe({
      next: (response) => {
        response.results.forEach(tk => {
          if (tk.step) {
            const stepKey = tk.step.toString();
            this.timer.remoteTimeKeeper[stepKey] = tk;

            if (!this.timer.timeKeeper[stepKey]) {
              const step = this.allSteps().find(s => s.id === tk.step);
              if (step && step.stepDuration) {
                this.timer.initializeTimer(tk.step, step.stepDuration);
              }
            }

            if (this.timer.timeKeeper[stepKey]) {
              if (tk.started) {
                const utcDate = new Date(tk.startTime).getTime();
                this.timer.timeKeeper[stepKey].startTime = utcDate;
                this.timer.timeKeeper[stepKey].started = true;
                if (tk.currentDuration !== undefined && tk.currentDuration !== null) {
                  this.timer.timeKeeper[stepKey].previousStop = tk.currentDuration;
                }
                if (!this.timer.currentTrackingStep.includes(tk.step)) {
                  this.timer.currentTrackingStep.push(tk.step);
                }
              } else {
                if (tk.currentDuration !== undefined && tk.currentDuration !== null) {
                  this.timer.timeKeeper[stepKey].current = tk.currentDuration;
                  this.timer.timeKeeper[stepKey].previousStop = tk.currentDuration;
                }
              }
            }
          }
        });
      },
      error: (err) => {
        console.error('Error loading timers:', err);
      }
    });
  }

  startTimer(stepId: number): void {
    const currentSession = this.session();
    if (!currentSession) return;

    const step = this.allSteps().find(s => s.id === stepId);
    if (!step) return;

    const localTimer = this.timer.timeKeeper[stepId.toString()];
    if (localTimer && localTimer.started) {
      this.toastService.info('Timer is already running');
      return;
    }

    const remoteTimer = this.timer.remoteTimeKeeper[stepId.toString()];

    if (!remoteTimer) {
      this.timeKeeperService.createTimeKeeper({
        session: currentSession.id,
        step: stepId,
        started: true,
        currentDuration: step.stepDuration || 0
      }).subscribe({
        next: (data) => {
          this.timer.remoteTimeKeeper[stepId.toString()] = data;
          const utcDate = new Date(data.startTime).getTime();
          this.timer.timeKeeper[stepId.toString()].startTime = utcDate;
          this.timer.timeKeeper[stepId.toString()].started = true;
          if (!this.timer.currentTrackingStep.includes(stepId)) {
            this.timer.currentTrackingStep.push(stepId);
          }
        },
        error: (err) => {
          this.toastService.error('Failed to start timer');
          console.error('Error starting timer:', err);
        }
      });
    } else if (remoteTimer.started) {
      const utcDate = new Date(remoteTimer.startTime).getTime();
      this.timer.timeKeeper[stepId.toString()].startTime = utcDate;
      this.timer.timeKeeper[stepId.toString()].started = true;
      if (!this.timer.currentTrackingStep.includes(stepId)) {
        this.timer.currentTrackingStep.push(stepId);
      }
      this.toastService.info('Timer synced with running timer');
    } else {
      const timeKeeperId = remoteTimer.id;
      this.timeKeeperService.startTimer(timeKeeperId).subscribe({
        next: (response) => {
          this.timer.remoteTimeKeeper[stepId.toString()] = response.timeKeeper;
          const utcDate = new Date(response.timeKeeper.startTime).getTime();
          this.timer.timeKeeper[stepId.toString()].startTime = utcDate;
          this.timer.timeKeeper[stepId.toString()].started = true;
          if (!this.timer.currentTrackingStep.includes(stepId)) {
            this.timer.currentTrackingStep.push(stepId);
          }
        },
        error: (err) => {
          this.toastService.error('Failed to start timer');
          console.error('Error starting timer:', err);
        }
      });
    }
  }

  pauseTimer(stepId: number): void {
    this.timer.timeKeeper[stepId.toString()].started = false;
    this.timer.timeKeeper[stepId.toString()].previousStop = this.timer.timeKeeper[stepId.toString()].current;

    if (this.timer.remoteTimeKeeper[stepId.toString()]) {
      const timeKeeperId = this.timer.remoteTimeKeeper[stepId.toString()].id;
      this.timeKeeperService.stopTimer(timeKeeperId).subscribe({
        next: (response) => {
          this.timer.remoteTimeKeeper[stepId.toString()] = response.timeKeeper;
        },
        error: (err) => {
          this.toastService.error('Failed to pause timer');
          console.error('Error pausing timer:', err);
        }
      });
    }
  }

  resetTimer(stepId: number): void {
    const step = this.allSteps().find(s => s.id === stepId);
    if (!step || !step.stepDuration) return;

    this.timer.timeKeeper[stepId.toString()].current = step.stepDuration;
    this.timer.timeKeeper[stepId.toString()].duration = step.stepDuration;
    this.timer.timeKeeper[stepId.toString()].previousStop = step.stepDuration;
    this.timer.timeKeeper[stepId.toString()].started = false;

    const remoteTimer = this.timer.remoteTimeKeeper[stepId.toString()];
    if (remoteTimer) {
      this.timeKeeperService.resetTimer(remoteTimer.id).subscribe({
        next: (response) => {
          this.timer.remoteTimeKeeper[stepId.toString()] = response.timeKeeper;
          this.toastService.success('Timer reset successfully');
        },
        error: (err) => {
          this.toastService.error('Failed to reset timer on server');
          console.error('Error resetting timer:', err);
        }
      });
    }
  }

  openAnnotationModal(): void {
    const step = this.currentStep();
    if (!step) {
      this.toastService.error('No step selected');
      return;
    }

    const modalRef = this.modalService.open(AnnotationModal, { size: 'lg', backdrop: 'static' });
    modalRef.componentInstance.stepId = step.id;

    modalRef.result.then(
      (result) => {
        if (result) {
          if (result.bookingData) {
            this.createAndLinkBooking(result.bookingData);
          } else if (result.calculatorData) {
            this.saveCalculatorAnnotation(result.calculatorData);
          } else if (result.molarityData) {
            this.saveMolarityAnnotation(result.molarityData);
          } else {
            this.uploadAnnotation(result.file, result.annotationType, result.annotationText, result.autoTranscribe);
          }
        }
      },
      () => {}
    );
  }

  createAndLinkBooking(bookingData: InstrumentUsageCreateRequest): void {
    const step = this.currentStep();
    const currentSession = this.session();

    if (!step || !currentSession) {
      this.toastService.error('Missing required information');
      return;
    }

    this.uploading.set(true);

    this.instrumentUsageService.createInstrumentUsage(bookingData).subscribe({
      next: (usage) => {
        this.stepAnnotationService.createStepAnnotation({
          session: currentSession.id,
          step: step.id,
          annotationData: {
            annotation: `Instrument booking: ${usage.instrumentName || 'Unknown'}`,
            annotationType: AnnotationType.Booking
          }
        }).subscribe({
          next: (annotation) => {
            this.bookingDataCache.update(cache => {
              const newCache = new Map(cache);
              if (annotation.instrumentUsageIds && annotation.instrumentUsageIds.length > 0) {
                annotation.instrumentUsageIds.forEach(id => {
                  newCache.set(id, usage);
                });
              }
              return newCache;
            });
            this.toastService.success('Instrument booked and linked to step');
            this.uploading.set(false);
            this.loadStepAnnotations();
          },
          error: (err) => {
            this.toastService.error('Failed to create step annotation for booking');
            console.error('Error creating step annotation:', err);
            this.uploading.set(false);
          }
        });
      },
      error: (err) => {
        this.toastService.error('Failed to create instrument booking');
        console.error('Error creating booking:', err);
        this.uploading.set(false);
      }
    });
  }

  saveCalculatorAnnotation(calculatorData: CalculatorHistoryData): void {
    const step = this.currentStep();
    const currentSession = this.session();

    if (!step || !currentSession) {
      this.toastService.error('Missing required information');
      return;
    }

    this.uploading.set(true);

    this.stepAnnotationService.createStepAnnotation({
      session: currentSession.id,
      step: step.id,
      annotationData: {
        annotation: JSON.stringify(calculatorData.history),
        annotationType: AnnotationType.Calculator
      }
    }).subscribe({
      next: () => {
        this.toastService.success('Calculator annotation saved');
        this.uploading.set(false);
        this.loadStepAnnotations();
      },
      error: (err) => {
        this.toastService.error('Failed to save calculator annotation');
        console.error('Error saving calculator annotation:', err);
        this.uploading.set(false);
      }
    });
  }

  saveMolarityAnnotation(molarityData: MolarityHistoryData): void {
    const step = this.currentStep();
    const currentSession = this.session();

    if (!step || !currentSession) {
      this.toastService.error('Missing required information');
      return;
    }

    this.uploading.set(true);

    this.stepAnnotationService.createStepAnnotation({
      session: currentSession.id,
      step: step.id,
      annotationData: {
        annotation: JSON.stringify(molarityData.history),
        annotationType: AnnotationType.MolarityCalculator
      }
    }).subscribe({
      next: () => {
        this.toastService.success('Molarity calculator annotation saved');
        this.uploading.set(false);
        this.loadStepAnnotations();
      },
      error: (err) => {
        this.toastService.error('Failed to save molarity annotation');
        console.error('Error saving molarity annotation:', err);
        this.uploading.set(false);
      }
    });
  }

  uploadAnnotation(file: File | null, annotationType: string, annotationText: string, autoTranscribe: boolean = true): void {
    const step = this.currentStep();
    const currentSession = this.session();

    if (!step || !currentSession || !file) {
      this.toastService.error('Missing required information for upload');
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(0);

    this.annotationUploadService.uploadStepAnnotationFileInChunks(
      file,
      currentSession.id,
      step.id,
      1024 * 1024,
      {
        annotation: annotationText || `Uploaded file: ${file.name}`,
        annotationType: annotationType,
        autoTranscribe: autoTranscribe,
        onProgress: (progress: number) => {
          this.uploadProgress.set(Math.round(progress));
        }
      } as any
    ).subscribe({
      next: () => {
        this.toastService.success('Annotation added successfully');
        this.uploading.set(false);
        this.uploadProgress.set(0);
        this.loadStepAnnotations();
      },
      error: (err) => {
        this.toastService.error('Failed to add annotation');
        console.error('Error adding annotation:', err);
        this.uploading.set(false);
        this.uploadProgress.set(0);
      }
    });
  }

  onTranscriptionContentChanged(content: string): void {
    const currentAnn = this.currentAnnotation();
    if (!currentAnn) return;

    this.stepAnnotationService.patchStepAnnotation(currentAnn.id, {
      annotationData: {
        transcription: content
      }
    }).subscribe({
      next: (updatedAnnotation) => {
        this.toastService.success('Transcription updated');
        const annotations = this.stepAnnotations();
        const index = annotations.findIndex(a => a.id === currentAnn.id);
        if (index !== -1) {
          const updated = [...annotations];
          updated[index] = updatedAnnotation;
          this.stepAnnotations.set(updated);
        }
      },
      error: (err) => {
        console.error('Error updating transcription:', err);
        this.toastService.error('Failed to update transcription');
      }
    });
  }

  onTranslationContentChanged(content: string): void {
    const currentAnn = this.currentAnnotation();
    if (!currentAnn) return;

    this.stepAnnotationService.patchStepAnnotation(currentAnn.id, {
      annotationData: {
        translation: content
      }
    }).subscribe({
      next: (updatedAnnotation) => {
        this.toastService.success('Translation updated');
        const annotations = this.stepAnnotations();
        const index = annotations.findIndex(a => a.id === currentAnn.id);
        if (index !== -1) {
          const updated = [...annotations];
          updated[index] = updatedAnnotation;
          this.stepAnnotations.set(updated);
        }
      },
      error: (err) => {
        console.error('Error updating translation:', err);
        this.toastService.error('Failed to update translation');
      }
    });
  }

  toggleAnnotationScratch(annotation: StepAnnotation): void {
    const newScratchedState = !annotation.scratched;

    this.stepAnnotationService.patchStepAnnotation(annotation.id, {
      annotationData: {
        scratched: newScratchedState
      }
    }).subscribe({
      next: () => {
        annotation.scratched = newScratchedState;
        const action = newScratchedState ? 'scratched' : 'unscratched';
        this.toastService.success(`Annotation ${action}`);
      },
      error: (err) => {
        this.toastService.error('Failed to toggle scratch status');
        console.error('Error toggling scratch:', err);
      }
    });
  }

  parseCalculatorHistory(annotationText: string | undefined): any[] {
    if (!annotationText) return [];
    try {
      return JSON.parse(annotationText);
    } catch (err) {
      console.error('Error parsing calculator history:', err);
      return [];
    }
  }

  getBookingData(bookingId: number): InstrumentUsage | null {
    const cached = this.bookingDataCache().get(bookingId);
    if (cached) {
      return cached;
    }

    if (!this.loadingBookings().has(bookingId)) {
      setTimeout(() => this.loadBookingData(bookingId), 0);
    }
    return null;
  }

  loadBookingData(bookingId: number): void {
    if (this.bookingDataCache().has(bookingId) || this.loadingBookings().has(bookingId)) {
      return;
    }

    this.loadingBookings.update(loading => {
      const newSet = new Set(loading);
      newSet.add(bookingId);
      return newSet;
    });

    this.instrumentUsageService.getInstrumentUsageRecord(bookingId).subscribe({
      next: (booking) => {
        this.bookingDataCache.update(cache => {
          const newCache = new Map(cache);
          newCache.set(bookingId, booking);
          return newCache;
        });

        this.loadingBookings.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(bookingId);
          return newSet;
        });

        if (booking.instrument) {
          this.loadInstrumentData(booking.instrument);
        }
      },
      error: (err) => {
        console.error(`Error loading booking ${bookingId}:`, err);
        this.loadingBookings.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(bookingId);
          return newSet;
        });
      }
    });
  }

  private loadInstrumentData(instrumentId: number): void {
    if (this.metadataTableCache().has(instrumentId) || this.loadingInstrumentMetadata().has(instrumentId)) {
      return;
    }

    this.loadingInstrumentMetadata.update(loading => {
      const newSet = new Set(loading);
      newSet.add(instrumentId);
      return newSet;
    });

    this.instrumentService.getInstrumentMetadata(instrumentId).subscribe({
      next: (metadataTable) => {
        this.metadataTableCache.update(cache => {
          const newCache = new Map(cache);
          newCache.set(instrumentId, metadataTable);
          return newCache;
        });

        this.loadingInstrumentMetadata.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(instrumentId);
          return newSet;
        });
      },
      error: (err) => {
        console.error(`Error loading instrument metadata ${instrumentId}:`, err);
        this.loadingInstrumentMetadata.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(instrumentId);
          return newSet;
        });
      }
    });
  }

  getMetadataForInstrument(instrumentId: number): MetadataTable | null {
    return this.metadataTableCache().get(instrumentId) || null;
  }

  private loadStoredReagentMetadata(storedReagentId: number): void {
    if (this.reagentMetadataCache().has(storedReagentId) || this.loadingReagentMetadata().has(storedReagentId)) {
      return;
    }

    this.loadingReagentMetadata.update(loading => {
      const newSet = new Set(loading);
      newSet.add(storedReagentId);
      return newSet;
    });

    this.reagentService.getStoredReagentMetadata(storedReagentId).subscribe({
      next: (metadataTable) => {
        this.reagentMetadataCache.update(cache => {
          const newCache = new Map(cache);
          newCache.set(storedReagentId, metadataTable);
          return newCache;
        });

        this.loadingReagentMetadata.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(storedReagentId);
          return newSet;
        });
      },
      error: (err) => {
        console.error(`Error loading stored reagent metadata ${storedReagentId}:`, err);
        this.loadingReagentMetadata.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(storedReagentId);
          return newSet;
        });
      }
    });
  }

  getMetadataForStoredReagent(storedReagentId: number): MetadataTable | null {
    return this.reagentMetadataCache().get(storedReagentId) || null;
  }

  private loadStoredReagent(storedReagentId: number): void {
    if (this.storedReagentCache().has(storedReagentId)) {
      return;
    }

    this.reagentService.getStoredReagent(storedReagentId).subscribe({
      next: (storedReagent) => {
        this.storedReagentCache.update(cache => {
          const newCache = new Map(cache);
          newCache.set(storedReagentId, storedReagent);
          return newCache;
        });
      },
      error: (err) => {
        console.error(`Error loading stored reagent ${storedReagentId}:`, err);
      }
    });
  }

  getActionsForStepReagent(stepReagent: any): ReagentAction[] {
    const step = this.currentStep();
    if (!step) return [];

    const stepActions = this.reagentActions().get(step.id) || [];
    const reagentTemplateId = stepReagent.reagent?.id || stepReagent.reagentId;

    if (!reagentTemplateId) return [];

    return stepActions.filter(action => {
      const storedReagent = this.storedReagentCache().get(action.reagent);
      return storedReagent && storedReagent.reagent === reagentTemplateId;
    });
  }

  toggleHistoryEntryScratched(annotation: StepAnnotation, entryId: string): void {
    const history = this.parseCalculatorHistory(annotation.annotationText);
    const updatedHistory = history.map(entry =>
      entry.id === entryId ? { ...entry, scratched: !entry.scratched } : entry
    );

    this.stepAnnotationService.patchStepAnnotation(annotation.id, {
      annotationData: {
        annotation: JSON.stringify(updatedHistory)
      }
    }).subscribe({
      next: () => {
        annotation.annotationText = JSON.stringify(updatedHistory);
        this.toastService.success('Entry updated');
      },
      error: (err) => {
        console.error('Error updating history entry:', err);
        this.toastService.error('Failed to update entry');
      }
    });
  }

  formatCalculatorExpression(entry: any): string {
    if (entry.inputPromptSecondValue !== undefined && entry.inputPromptSecondValue !== 0) {
      const opSymbol = this.getOperationSymbol(entry.operation);
      return `${entry.inputPromptFirstValue} ${opSymbol} ${entry.inputPromptSecondValue} = ${this.formatNumber(entry.result)}`;
    } else {
      return `${entry.operation}(${entry.inputPromptFirstValue}) = ${this.formatNumber(entry.result)}`;
    }
  }

  formatMolarityCalculatorExpression(entry: any): string {
    if (!entry.data) return `Result: ${this.formatNumber(entry.result)}`;

    const data = entry.data;
    const resultStr = `${this.formatNumber(entry.result)} ${entry.calculatedField || ''}`;

    switch (entry.operationType) {
      case 'massFromVolumeAndConcentration':
        return `Mass = ${resultStr} (from ${data.concentration} ${data.concentrationUnit}, ${data.volume} ${data.volumeUnit}, MW: ${data.molecularWeight})`;
      case 'volumeFromMassAndConcentration':
        return `Volume = ${resultStr} (from ${data.weight} ${data.weightUnit}, ${data.concentration} ${data.concentrationUnit}, MW: ${data.molecularWeight})`;
      case 'concentrationFromMassAndVolume':
        return `Concentration = ${resultStr} (from ${data.weight} ${data.weightUnit}, ${data.volume} ${data.volumeUnit}, MW: ${data.molecularWeight})`;
      case 'volumeFromStockVolumeAndConcentration':
        return `Volume = ${resultStr} (from stock: ${data.stockConcentration} ${data.stockConcentrationUnit}, target: ${data.targetConcentration} ${data.targetConcentrationUnit})`;
      default:
        return resultStr;
    }
  }

  private getOperationSymbol(operation: string): string {
    switch (operation) {
      case '+': return '+';
      case '-': return '−';
      case '*': return '×';
      case '/': return '÷';
      case '^': return '^';
      default: return operation;
    }
  }

  private formatNumber(value: number): string {
    if (Math.abs(value) < 1e-10 && value !== 0) {
      return value.toExponential(6);
    }
    if (Math.abs(value) > 1e12) {
      return value.toExponential(6);
    }
    return parseFloat(value.toPrecision(12)).toString();
  }

  shareAnnotation(annotation: StepAnnotation): void {
    const currentSession = this.session();
    if (!currentSession) return;

    const baseUrl = window.location.origin;
    const url = `${baseUrl}/#/protocols/sessions/${currentSession.id}?annotationId=${annotation.id}`;

    navigator.clipboard.writeText(url).then(() => {
      this.toastService.success('Annotation link copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy URL:', err);
      this.toastService.error('Failed to copy link');
    });
  }

  deleteAnnotation(annotation: StepAnnotation): void {
    if (!this.canDeleteAnnotations()) {
      this.toastService.error('You do not have permission to delete annotations');
      return;
    }

    const confirmMessage = `Are you sure you want to delete this annotation? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    this.stepAnnotationService.deleteStepAnnotation(annotation.id).subscribe({
      next: () => {
        this.toastService.success('Annotation deleted successfully');
        this.loadStepAnnotations();
      },
      error: (err) => {
        console.error('Error deleting annotation:', err);
        this.toastService.error('Failed to delete annotation');
      }
    });
  }

  onMediaTimeUpdate(annotationId: number, event: Event): void {
    const media = event.target as HTMLMediaElement;
    const times = this.mediaCurrentTimes();
    times.set(annotationId, media.currentTime);
    this.mediaCurrentTimes.set(new Map(times));
  }

  getMediaCurrentTime(annotationId: number): number {
    return this.mediaCurrentTimes().get(annotationId) || 0;
  }

  toggleWebRTC(): void {
    this.showWebRTC.update(show => !show);
  }

  downloadAnnotation(annotation: StepAnnotation): void {
    if (!annotation.id) {
      this.toastService.error('Invalid annotation');
      return;
    }

    this.stepAnnotationService.getStepAnnotation(annotation.id).subscribe({
      next: (freshAnnotation) => {
        if (freshAnnotation.fileUrl) {
          const link = document.createElement('a');
          link.href = freshAnnotation.fileUrl;
          link.download = freshAnnotation.annotationName || 'file';
          link.click();
        } else {
          this.toastService.error('No file URL available');
        }
      },
      error: (err) => {
        console.error('Error fetching fresh download URL:', err);
        this.toastService.error('Failed to download file');
      }
    });
  }

  isTranscribing(annotation: StepAnnotation): boolean {
    if (!annotation.annotation) return false;
    return this.transcribingAnnotations().has(annotation.annotation);
  }

  getTranscriptionProgress(annotation: StepAnnotation): { percentage: number; description: string } | null {
    if (!annotation.annotation) return null;
    return this.transcriptionProgress().get(annotation.annotation) || null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.notificationWs.disconnect();
    this.timer.ngOnDestroy();
  }
}
