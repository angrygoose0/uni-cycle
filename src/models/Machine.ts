import { Machine as MachineInterface, MachineRow, MachineStatus } from '../types';

/**
 * Machine entity class with time-based status calculation
 * Status is determined by comparing current time with timer_end_time
 */
export class Machine implements MachineInterface {
  public readonly id: number;
  public readonly name: string;
  public timerEndTime?: number;
  public readonly createdAt: number;
  public updatedAt: number;

  constructor(data: MachineInterface) {
    this.id = data.id;
    this.name = data.name;
    this.timerEndTime = data.timerEndTime;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;

    this.validate();
  }

  /**
   * Get current status based on timer_end_time vs current time
   */
  get status(): 'available' | 'in-use' {
    if (!this.timerEndTime) {
      return 'available';
    }
    
    const now = Math.floor(Date.now() / 1000);
    return this.timerEndTime > now ? 'in-use' : 'available';
  }

  /**
   * Create Machine instance from database row
   */
  static fromRow(row: MachineRow): Machine {
    return new Machine({
      id: row.id,
      name: row.name,
      timerEndTime: row.timer_end_time || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  /**
   * Convert Machine instance to database row format
   */
  toRow(): Omit<MachineRow, 'id'> {
    return {
      name: this.name,
      timer_end_time: this.timerEndTime || null,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Convert to MachineStatus for API responses
   */
  toStatus(): MachineStatus {
    const remainingTimeMs = this.getRemainingTimeMs();
    
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      remainingTimeMs: remainingTimeMs > 0 ? remainingTimeMs : undefined
    };
  }

  /**
   * Validate machine data
   */
  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Machine name is required');
    }

    if (this.name.length > 100) {
      throw new Error('Machine name must be 100 characters or less');
    }

    if (this.timerEndTime && this.timerEndTime <= 0) {
      throw new Error('Timer end time must be a positive timestamp');
    }

    if (this.createdAt <= 0 || this.updatedAt <= 0) {
      throw new Error('Created and updated timestamps must be positive');
    }

    if (this.updatedAt < this.createdAt) {
      throw new Error('Updated timestamp cannot be before created timestamp');
    }
  }

  /**
   * Validate timer duration in minutes
   */
  static validateTimerDuration(durationMinutes: number): void {
    if (!Number.isInteger(durationMinutes)) {
      throw new Error('Timer duration must be an integer');
    }

    if (durationMinutes < 1) {
      throw new Error('Timer duration must be at least 1 minute');
    }

    if (durationMinutes > 120) {
      throw new Error('Timer duration cannot exceed 120 minutes (2 hours)');
    }
  }

  /**
   * Set timer for this machine
   */
  setTimer(durationMinutes: number): void {
    Machine.validateTimerDuration(durationMinutes);

    // Allow timer override - remove the in-use check
    const now = Math.floor(Date.now() / 1000);
    this.timerEndTime = now + (durationMinutes * 60);
    this.updatedAt = now;

    this.validate();
  }

  /**
   * Clear timer and make machine available
   */
  clearTimer(): void {
    this.timerEndTime = undefined;
    this.updatedAt = Math.floor(Date.now() / 1000);

    this.validate();
  }

  /**
   * Check if timer has expired
   */
  isTimerExpired(): boolean {
    if (!this.timerEndTime) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    return now >= this.timerEndTime;
  }

  /**
   * Get remaining time in milliseconds
   */
  getRemainingTimeMs(): number {
    if (!this.timerEndTime) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = this.timerEndTime - now;
    
    return Math.max(0, remainingSeconds * 1000);
  }

  /**
   * Get remaining time in minutes (rounded up)
   */
  getRemainingMinutes(): number {
    const remainingMs = this.getRemainingTimeMs();
    return Math.ceil(remainingMs / (1000 * 60));
  }

  /**
   * Check if machine is available for use
   */
  isAvailable(): boolean {
    return this.status === 'available' || this.isTimerExpired();
  }
}