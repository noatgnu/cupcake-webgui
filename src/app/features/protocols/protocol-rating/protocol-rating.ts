import { Component, ChangeDetectionStrategy, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, ToastService } from '@noatgnu/cupcake-core';
import { ProtocolRatingService } from '@noatgnu/cupcake-red-velvet';
import type { ProtocolRating as ProtocolRatingModel } from '@noatgnu/cupcake-red-velvet';

@Component({
  selector: 'app-protocol-rating',
  imports: [FormsModule],
  templateUrl: './protocol-rating.html',
  styleUrl: './protocol-rating.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProtocolRating {
  private ratingService = inject(ProtocolRatingService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  protocolId = input.required<number>();
  saved = output<ProtocolRatingModel>();

  readonly scale = Array.from({ length: 11 }, (_, i) => i);
  rating = signal<ProtocolRatingModel | null>(null);
  complexity = signal(5);
  duration = signal(5);
  saving = signal(false);

  constructor() {
    effect(() => this.loadRating(this.protocolId()));
  }

  /**
   * Load the current user's rating of the protocol, if any.
   */
  loadRating(protocolId: number): void {
    const user = this.authService.currentUser();
    this.rating.set(null);
    this.complexity.set(5);
    this.duration.set(5);
    if (!user) {
      return;
    }
    this.ratingService.getProtocolRatings({ protocol: protocolId, user: user.id, limit: 1 }).subscribe({
      next: (response) => {
        const rating = response.results[0];
        if (rating) {
          this.rating.set(rating);
          this.complexity.set(rating.complexityRating);
          this.duration.set(rating.durationRating);
        }
      },
      error: () => this.toastService.error('Failed to load your rating')
    });
  }

  /**
   * Create the user's rating, or update the existing one.
   */
  save(): void {
    const existing = this.rating();
    const values = { complexityRating: this.complexity(), durationRating: this.duration() };
    const request = existing
      ? this.ratingService.patchProtocolRating(existing.id, values)
      : this.ratingService.createProtocolRating({ protocol: this.protocolId(), ...values });
    this.saving.set(true);
    request.subscribe({
      next: (rating) => {
        this.rating.set(rating);
        this.saving.set(false);
        this.toastService.success('Rating saved');
        this.saved.emit(rating);
      },
      error: () => {
        this.saving.set(false);
        this.toastService.error('Failed to save rating');
      }
    });
  }
}
