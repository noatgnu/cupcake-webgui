import { Component, inject, OnInit, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InstrumentService, InstrumentUsageService, InstrumentPermissionService } from '@noatgnu/cupcake-macaron';
import type { Instrument, InstrumentUsage } from '@noatgnu/cupcake-macaron';
import { ToastService } from '@noatgnu/cupcake-core';

@Component({
  selector: 'app-instrument-booking-annotation',
  imports: [CommonModule, FormsModule],
  templateUrl: './instrument-booking-annotation.html',
  styleUrl: './instrument-booking-annotation.scss'
})
export class InstrumentBookingAnnotation implements OnInit {
  private instrumentService = inject(InstrumentService);
  private instrumentUsageService = inject(InstrumentUsageService);
  private instrumentPermissionService = inject(InstrumentPermissionService);
  private toastService = inject(ToastService);

  @Output() cancelled = new EventEmitter<void>();

  availableInstruments = signal<Instrument[]>([]);
  loadingInstruments = signal(false);
  selectedInstrumentId = signal<number | null>(null);
  bookingDescription = signal('');

  startDateTime = signal('');
  endDateTime = signal('');

  creating = signal(false);

  selectedInstrument = signal<Instrument | null>(null);

  searchQuery = signal('');
  currentPage = signal(1);
  pageSize = 10;
  totalInstruments = signal(0);
  totalPages = signal(0);

  existingBookings = signal<InstrumentUsage[]>([]);
  loadingBookings = signal(false);
  hasOverlappingBookings = signal(false);

  ngOnInit(): void {
    this.loadAvailableInstruments();
    this.setDefaultTimes();
  }

  setDefaultTimes(): void {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    this.startDateTime.set(this.formatDateTimeLocal(start));
    this.endDateTime.set(this.formatDateTimeLocal(end));
  }

  formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  loadAvailableInstruments(): void {
    this.loadingInstruments.set(true);

    this.instrumentPermissionService.getBookingPermissions().subscribe({
      next: (response) => {
        const instrumentIds = response.results.map(p => p.instrument);

        if (instrumentIds.length === 0) {
          this.availableInstruments.set([]);
          this.totalInstruments.set(0);
          this.totalPages.set(0);
          this.loadingInstruments.set(false);
          return;
        }

        const offset = (this.currentPage() - 1) * this.pageSize;
        const params: any = {
          enabled: true,
          limit: this.pageSize,
          offset: offset
        };

        if (this.searchQuery()) {
          params.search = this.searchQuery();
        }

        this.instrumentService.getInstruments(params).subscribe({
          next: (instResponse) => {
            const bookableInstruments = instResponse.results.filter(inst =>
              instrumentIds.includes(inst.id) && inst.acceptsBookings
            );
            this.availableInstruments.set(bookableInstruments);
            this.totalInstruments.set(instResponse.count || 0);
            this.totalPages.set(Math.ceil((instResponse.count || 0) / this.pageSize));
            this.loadingInstruments.set(false);
          },
          error: (err) => {
            console.error('Error loading instruments:', err);
            this.toastService.error('Failed to load instruments');
            this.loadingInstruments.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error loading permissions:', err);
        this.toastService.error('Failed to load instrument permissions');
        this.loadingInstruments.set(false);
      }
    });
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
    this.loadAvailableInstruments();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadAvailableInstruments();
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  onInstrumentSelected(instrumentId: string): void {
    const id = parseInt(instrumentId, 10);
    this.selectedInstrumentId.set(id);

    const instrument = this.availableInstruments().find(i => i.id === id);
    this.selectedInstrument.set(instrument || null);

    if (id) {
      this.loadExistingBookings();
    }
  }

  onDateTimeChange(): void {
    if (this.selectedInstrumentId()) {
      this.loadExistingBookings();
    }
  }

  loadExistingBookings(): void {
    const instrumentId = this.selectedInstrumentId();
    const startTime = this.startDateTime();
    const endTime = this.endDateTime();

    if (!instrumentId || !startTime || !endTime) {
      this.existingBookings.set([]);
      this.hasOverlappingBookings.set(false);
      return;
    }

    this.loadingBookings.set(true);

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    this.instrumentUsageService.getInstrumentUsage({
      instrument: instrumentId,
      timeStarted__lte: endDate.toISOString(),
      timeEnded__gte: startDate.toISOString(),
      limit: 100,
      ordering: 'time_started'
    }).subscribe({
      next: (response) => {
        this.existingBookings.set(response.results);
        this.checkForOverlaps();
        this.loadingBookings.set(false);
      },
      error: (err) => {
        console.error('Error loading bookings:', err);
        this.existingBookings.set([]);
        this.hasOverlappingBookings.set(false);
        this.loadingBookings.set(false);
      }
    });
  }

  checkForOverlaps(): void {
    const startTime = this.startDateTime();
    const endTime = this.endDateTime();
    const bookings = this.existingBookings();

    if (!startTime || !endTime || bookings.length === 0) {
      this.hasOverlappingBookings.set(false);
      return;
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    const hasOverlap = bookings.some(booking => {
      if (!booking.timeStarted || !booking.timeEnded) return false;

      const existingStart = new Date(booking.timeStarted);
      const existingEnd = new Date(booking.timeEnded);

      return newStart < existingEnd && newEnd > existingStart;
    });

    this.hasOverlappingBookings.set(hasOverlap);
  }

  getBookingData() {
    const instrumentId = this.selectedInstrumentId();
    if (!instrumentId) {
      return null;
    }

    const startTime = this.startDateTime();
    const endTime = this.endDateTime();

    if (!startTime || !endTime) {
      return null;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return null;
    }

    return {
      instrument: instrumentId,
      timeStarted: new Date(startTime).toISOString(),
      timeEnded: new Date(endTime).toISOString(),
      description: this.bookingDescription() || 'Instrument booking for protocol session'
    };
  }

  getTimelineStartDate(): Date {
    const startTime = this.startDateTime();
    const endTime = this.endDateTime();
    const bookings = this.existingBookings();

    if (!startTime && !endTime && bookings.length === 0) {
      return new Date();
    }

    const dates = [];
    if (startTime) dates.push(new Date(startTime));
    if (endTime) dates.push(new Date(endTime));
    bookings.forEach(b => {
      if (b.timeStarted) dates.push(new Date(b.timeStarted));
      if (b.timeEnded) dates.push(new Date(b.timeEnded));
    });

    return dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
  }

  getTimelineEndDate(): Date {
    const startTime = this.startDateTime();
    const endTime = this.endDateTime();
    const bookings = this.existingBookings();

    if (!startTime && !endTime && bookings.length === 0) {
      return new Date();
    }

    const dates = [];
    if (startTime) dates.push(new Date(startTime));
    if (endTime) dates.push(new Date(endTime));
    bookings.forEach(b => {
      if (b.timeStarted) dates.push(new Date(b.timeStarted));
      if (b.timeEnded) dates.push(new Date(b.timeEnded));
    });

    return dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
  }

  calculateBookingPosition(booking: any): { left: number; width: number } {
    const timelineStart = this.getTimelineStartDate().getTime();
    const timelineEnd = this.getTimelineEndDate().getTime();
    const timelineRange = timelineEnd - timelineStart;

    if (!booking.timeStarted || !booking.timeEnded || timelineRange === 0) {
      return { left: 0, width: 0 };
    }

    const bookingStart = new Date(booking.timeStarted).getTime();
    const bookingEnd = new Date(booking.timeEnded).getTime();

    const left = ((bookingStart - timelineStart) / timelineRange) * 100;
    const width = ((bookingEnd - bookingStart) / timelineRange) * 100;

    return {
      left: Math.max(0, Math.min(100, left)),
      width: Math.max(0, Math.min(100 - left, width))
    };
  }

  calculateYourBookingPosition(): { left: number; width: number } {
    const startTime = this.startDateTime();
    const endTime = this.endDateTime();

    if (!startTime || !endTime) {
      return { left: 0, width: 0 };
    }

    const timelineStart = this.getTimelineStartDate().getTime();
    const timelineEnd = this.getTimelineEndDate().getTime();
    const timelineRange = timelineEnd - timelineStart;

    if (timelineRange === 0) {
      return { left: 0, width: 100 };
    }

    const bookingStart = new Date(startTime).getTime();
    const bookingEnd = new Date(endTime).getTime();

    const left = ((bookingStart - timelineStart) / timelineRange) * 100;
    const width = ((bookingEnd - bookingStart) / timelineRange) * 100;

    return {
      left: Math.max(0, Math.min(100, left)),
      width: Math.max(0, Math.min(100 - left, width))
    };
  }

  getBookingTooltip(booking: any): string {
    const start = booking.timeStarted ? new Date(booking.timeStarted).toLocaleString() : 'Unknown';
    const end = booking.timeEnded ? new Date(booking.timeEnded).toLocaleString() : 'Unknown';
    const user = booking.userUsername || 'Unknown User';
    const status = booking.approved ? 'Approved' : 'Pending';
    return `${user} (${status})\n${start} - ${end}${booking.description ? '\n' + booking.description : ''}`;
  }

  calculateBookingRow(booking: any): number {
    const bookings = this.existingBookings();

    if (!booking.timeStarted || !booking.timeEnded) {
      return 1;
    }

    const bookingStart = new Date(booking.timeStarted).getTime();
    const bookingEnd = new Date(booking.timeEnded).getTime();

    const rows: Array<Array<any>> = [[]];

    for (const b of bookings) {
      if (b.id === booking.id) {
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          let canFit = true;

          for (const rowBooking of row) {
            if (!rowBooking.timeStarted || !rowBooking.timeEnded) continue;

            const rowStart = new Date(rowBooking.timeStarted).getTime();
            const rowEnd = new Date(rowBooking.timeEnded).getTime();

            if (bookingStart < rowEnd && bookingEnd > rowStart) {
              canFit = false;
              break;
            }
          }

          if (canFit) {
            return rowIndex + 1;
          }
        }

        rows.push([]);
        return rows.length;
      }

      if (!b.timeStarted || !b.timeEnded) continue;

      const bStart = new Date(b.timeStarted).getTime();
      const bEnd = new Date(b.timeEnded).getTime();

      let placed = false;
      for (const row of rows) {
        let canFit = true;

        for (const rowBooking of row) {
          if (!rowBooking.timeStarted || !rowBooking.timeEnded) continue;

          const rowStart = new Date(rowBooking.timeStarted).getTime();
          const rowEnd = new Date(rowBooking.timeEnded).getTime();

          if (bStart < rowEnd && bEnd > rowStart) {
            canFit = false;
            break;
          }
        }

        if (canFit) {
          row.push(b);
          placed = true;
          break;
        }
      }

      if (!placed) {
        rows.push([b]);
      }
    }

    return 1;
  }

  getTimelineHeight(): number {
    const bookings = this.existingBookings();
    if (bookings.length === 0) return 40;

    const rows: Array<Array<any>> = [[]];

    for (const b of bookings) {
      if (!b.timeStarted || !b.timeEnded) continue;

      const bStart = new Date(b.timeStarted).getTime();
      const bEnd = new Date(b.timeEnded).getTime();

      let placed = false;
      for (const row of rows) {
        let canFit = true;

        for (const rowBooking of row) {
          if (!rowBooking.timeStarted || !rowBooking.timeEnded) continue;

          const rowStart = new Date(rowBooking.timeStarted).getTime();
          const rowEnd = new Date(rowBooking.timeEnded).getTime();

          if (bStart < rowEnd && bEnd > rowStart) {
            canFit = false;
            break;
          }
        }

        if (canFit) {
          row.push(b);
          placed = true;
          break;
        }
      }

      if (!placed) {
        rows.push([b]);
      }
    }

    return Math.max(40, (rows.length + 1) * 24);
  }

  isValid(): boolean {
    const instrumentId = this.selectedInstrumentId();
    const startTime = this.startDateTime();
    const endTime = this.endDateTime();

    if (!instrumentId || !startTime || !endTime) {
      return false;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return false;
    }

    const instrument = this.selectedInstrument();
    if (this.hasOverlappingBookings() && instrument && !instrument.allowOverlappingBookings) {
      return false;
    }

    return true;
  }

  cancel(): void {
    this.cancelled.emit();
  }

  calculateDuration(): string {
    const start = this.startDateTime();
    const end = this.endDateTime();

    if (!start || !end) return '';

    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();

    if (diffMs <= 0) return '';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
