/**
 * Frontend-only MachineService - Business logic for machine operations
 * Converted from backend service to use LocalStorageService instead of database
 */

import { LocalStorageService, MachineData } from './LocalStorageService';
import { MachineStatus } from './types';
import { StorageEventService } from './StorageEventService';

/**
 * Frontend Machine class for business logic operations
 */
class FrontendMachine {
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
   * Convert to MachineData for storage
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
    FrontendMachine.validateTimerDuration(durationMinutes);

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

/**
 * Frontend-only MachineService class
 * Provides business logic for machine operations using LocalStorageService
 */
export class MachineService {
  private storageService: LocalStorageService;
  private storageEventService: StorageEventService;

  constructor(storageService?: LocalStorageService, storageEventService?: StorageEventService) {
    this.storageService = storageService || new LocalStorageService();
    this.storageEventService = storageEventService || new StorageEventService(this.storageService);
  }

  /**
   * Initialize default machines if storage is empty
   * This is called automatically when needed
   */
  public initializeDefaultMachines(): void {
    try {
      // LocalStorageService already handles initialization with defaults
      // This method ensures we have machines available
      const machines = this.storageService.getMachines();
      if (machines.length === 0) {
        this.storageService.resetToDefaults();
      }
    } catch (error) {
      throw new Error(`Failed to initialize default machines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all machines with their current status
   */
  public getAllMachines(): MachineStatus[] {
    try {
      const machineData = this.storageService.getMachines();
      const machines = machineData.map(data => new FrontendMachine(data));
      return machines.map(machine => machine.toStatus());
    } catch (error) {
      throw new Error(`Failed to retrieve machines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific machine by ID
   */
  public getMachineById(id: number): MachineStatus | null {
    try {
      this.validateMachineId(id);

      const machineData = this.storageService.getMachineById(id);
      if (!machineData) {
        return null;
      }

      const machine = new FrontendMachine(machineData);
      return machine.toStatus();
    } catch (error) {
      throw new Error(`Failed to retrieve machine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set timer for a machine
   */
  public setTimer(machineId: number, durationMinutes: number): MachineStatus {
    try {
      // Validate inputs
      this.validateMachineId(machineId);
      this.validateTimerDuration(durationMinutes);

      // Check if machine exists
      const existingMachineData = this.storageService.getMachineById(machineId);
      if (!existingMachineData) {
        throw new Error(`Machine with ID ${machineId} not found`);
      }

      // Create machine instance and set timer
      const machine = new FrontendMachine(existingMachineData);
      machine.setTimer(durationMinutes);

      // Save updated machine data
      this.storageService.updateMachine(machine.toData());

      const machineStatus = machine.toStatus();

      // Broadcast timer set event to other tabs (requirement 6.2)
      this.storageEventService.broadcastTimerSet(machineId, machineStatus);

      return machineStatus;
    } catch (error) {
      throw new Error(`Failed to set timer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear timer for a machine (make it available)
   */
  public clearTimer(machineId: number): MachineStatus {
    try {
      this.validateMachineId(machineId);

      // Check if machine exists
      const existingMachineData = this.storageService.getMachineById(machineId);
      if (!existingMachineData) {
        throw new Error(`Machine with ID ${machineId} not found`);
      }

      // Create machine instance and clear timer
      const machine = new FrontendMachine(existingMachineData);
      machine.clearTimer();

      // Save updated machine data
      this.storageService.updateMachine(machine.toData());

      const machineStatus = machine.toStatus();

      // Broadcast machine updated event to other tabs
      this.storageEventService.broadcastMachineUpdated(machineId, machineStatus);

      return machineStatus;
    } catch (error) {
      throw new Error(`Failed to clear timer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get machines that are currently available
   */
  public getAvailableMachines(): MachineStatus[] {
    try {
      const machineData = this.storageService.getMachines();
      const machines = machineData.map(data => new FrontendMachine(data));
      const availableMachines = machines.filter(machine => machine.isAvailable());
      return availableMachines.map(machine => machine.toStatus());
    } catch (error) {
      throw new Error(`Failed to retrieve available machines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get machines with active timers
   */
  public getMachinesWithActiveTimers(): MachineStatus[] {
    try {
      const machineData = this.storageService.getMachines();
      const machines = machineData.map(data => new FrontendMachine(data));
      // Filter out expired timers
      const activeMachines = machines.filter(machine => !machine.isTimerExpired() && machine.timerEndTime);
      return activeMachines.map(machine => machine.toStatus());
    } catch (error) {
      throw new Error(`Failed to retrieve machines with active timers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a machine is available for use
   */
  public isMachineAvailable(machineId: number): boolean {
    try {
      this.validateMachineId(machineId);

      const machineData = this.storageService.getMachineById(machineId);
      if (!machineData) {
        return false;
      }

      const machine = new FrontendMachine(machineData);
      return machine.isAvailable();
    } catch (error) {
      throw new Error(`Failed to check machine availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get machine usage statistics
   */
  public getMachineStats(): { available: number; inUse: number; total: number } {
    try {
      const machineData = this.storageService.getMachines();
      const machines = machineData.map(data => new FrontendMachine(data));
      
      const available = machines.filter(machine => machine.isAvailable()).length;
      const inUse = machines.filter(machine => !machine.isAvailable()).length;
      const total = machines.length;

      return { available, inUse, total };
    } catch (error) {
      throw new Error(`Failed to retrieve machine statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate machine ID
   */
  private validateMachineId(id: number): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Machine ID must be a positive integer');
    }
  }

  /**
   * Validate timer duration
   */
  private validateTimerDuration(durationMinutes: number): void {
    try {
      FrontendMachine.validateTimerDuration(durationMinutes);
    } catch (error) {
      throw new Error(`Invalid timer duration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}