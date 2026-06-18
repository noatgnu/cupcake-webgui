import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { LabGroupInvitation, LabGroupService, ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-lab-group-invitation-accept',
  imports: [],
  templateUrl: './lab-group-invitation-accept.html',
  styleUrl: './lab-group-invitation-accept.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabGroupInvitationAccept implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private labGroupService = inject(LabGroupService);
  private toastService = inject(ToastService);

  invitation = signal<LabGroupInvitation | null>(null);
  loading = signal(true);
  responding = signal(false);
  notFound = signal(false);

  ngOnInit(): void {
    const invitationId = Number(this.route.snapshot.paramMap.get('id'));
    this.labGroupService.getMyPendingInvitations().subscribe({
      next: (invitations) => {
        const match = invitations.find(invitation => invitation.id === invitationId);
        if (match) {
          this.invitation.set(match);
        } else {
          this.notFound.set(true);
        }
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      }
    });
  }

  accept(): void {
    const invitation = this.invitation();
    if (!invitation) return;

    this.responding.set(true);
    this.labGroupService.acceptLabGroupInvitation(invitation.id).subscribe({
      next: (response) => {
        this.toastService.success(response.message);
        this.router.navigate(['/home/lab-groups']);
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || 'Failed to accept invitation');
        this.responding.set(false);
      }
    });
  }

  reject(): void {
    const invitation = this.invitation();
    if (!invitation) return;

    this.responding.set(true);
    this.labGroupService.rejectLabGroupInvitation(invitation.id).subscribe({
      next: (response) => {
        this.toastService.success(response.message);
        this.router.navigate(['/home/lab-groups']);
      },
      error: (err) => {
        this.toastService.error(err.error?.detail || 'Failed to reject invitation');
        this.responding.set(false);
      }
    });
  }
}
