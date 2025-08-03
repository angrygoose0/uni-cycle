import { MachineStatus } from './types';

/**
 * Frontend Machine interface for localStorage data
 */
export interface MachineData {
  id: number;
  name: string;
  timerEndTime?: number; // Unix timestamp in seconds
  createdAt: number;
  updatedAt: number;
}

/**
 * Frontend Machine entity class with time-based status calculation
 * Adapted from backend version for localStorage usage
 * Status is determined by comparing current time with timer_end_time
 */
export class Machine implements MachineData {
  public readonly id: number;
  public readonly name: string;
  public timerEndTime?: number;
  public readonly createdAt: number;
  public updatedAt: number;

  constructor(data: MachineData) {
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
   * Convert to MachineStatus for UI display
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
   * Convert to localStorage data format
   */
  toData(): MachineData {
    return {
      id: this.id,
      name: this.name,
      timerEndTime: this.timerEndTime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create Machine instance from localStorage data
   */
  static fromData(data: MachineData): Machine {
    return new Machine(data);
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

    if (this.timerEndTime !== undefined && this.timerEndTime <= 0) {
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

    if (durationMinutes > 300) {
      throw new Error('Timer duration cannot exceed 300 minutes (5 hours)');
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