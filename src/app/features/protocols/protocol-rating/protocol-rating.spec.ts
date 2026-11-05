import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService, ToastService } from '@noatgnu/cupcake-core';
import { ProtocolRatingService } from '@noatgnu/cupcake-red-velvet';
import type { ProtocolRating as ProtocolRatingModel } from '@noatgnu/cupcake-red-velvet';
import { ProtocolRating } from './protocol-rating';

describe('ProtocolRating', () => {
  let component: ProtocolRating;
  let fixture: ComponentFixture<ProtocolRating>;
  let ratingService: jasmine.SpyObj<ProtocolRatingService>;
  let toastService: jasmine.SpyObj<ToastService>;

  const existing = {
    id: 9,
    protocol: 3,
    user: 7,
    complexityRating: 4,
    durationRating: 6
  } as ProtocolRatingModel;

  function setup(results: ProtocolRatingModel[]): void {
    ratingService = jasmine.createSpyObj('ProtocolRatingService', [
      'getProtocolRatings',
      'createProtocolRating',
      'patchProtocolRating'
    ]);
    ratingService.getProtocolRatings.and.returnValue(of({ count: results.length, results }));
    toastService = jasmine.createSpyObj('ToastService', ['success', 'error']);

    TestBed.configureTestingModule({
      imports: [ProtocolRating],
      providers: [
        { provide: ProtocolRatingService, useValue: ratingService },
        { provide: ToastService, useValue: toastService },
        { provide: AuthService, useValue: { currentUser: signal({ id: 7 }) } }
      ]
    });
    fixture = TestBed.createComponent(ProtocolRating);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('protocolId', 3);
    fixture.detectChanges();
  }

  it('loads only the current user rating of the protocol', () => {
    setup([existing]);
    expect(ratingService.getProtocolRatings).toHaveBeenCalledWith({ protocol: 3, user: 7, limit: 1 });
    expect(component.complexity()).toBe(4);
    expect(component.duration()).toBe(6);
  });

  it('creates a rating when the user has none', () => {
    setup([]);
    const created = { ...existing, complexityRating: 8, durationRating: 2 };
    ratingService.createProtocolRating.and.returnValue(of(created));
    const emitted: ProtocolRatingModel[] = [];
    component.saved.subscribe(rating => emitted.push(rating));
    component.complexity.set(8);
    component.duration.set(2);

    component.save();

    expect(ratingService.createProtocolRating).toHaveBeenCalledWith({ protocol: 3, complexityRating: 8, durationRating: 2 });
    expect(emitted).toEqual([created]);
    expect(component.rating()).toEqual(created);
  });

  it('updates the existing rating', () => {
    setup([existing]);
    ratingService.patchProtocolRating.and.returnValue(of({ ...existing, complexityRating: 10 }));
    component.complexity.set(10);

    component.save();

    expect(ratingService.patchProtocolRating).toHaveBeenCalledWith(9, { complexityRating: 10, durationRating: 6 });
    expect(ratingService.createProtocolRating).not.toHaveBeenCalled();
  });
});
