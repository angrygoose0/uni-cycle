/**
 * TimerService - Client-side timer management service
 * Handles automatic timer expiration and machine status updates
 * Provides event system for timer expiration notifications
 */

import { LocalStorageService, MachineData } from './LocalStorageService';
import { MachineService } from './MachineService';
import { MachineStatus } from './types';
import { StorageEventService } from './StorageEventService';

export interface TimerExpiredEvent {
  type: 'timer_expired';
  machineId: number;
  machine: MachineStatus;
  timestamp: number;
}

export interface TimerSetEvent {
  type: 'timer_set';
  machineId: number;
  machine: MachineStatus;
  timestamp: number;
}

export interface TimerClearedEvent {
  type: 'timer_cleared';
  machineId: number;
  machine: MachineStatus;
  timestamp: number;
}

export type TimerEvent = TimerExpiredEvent | TimerSetEvent | TimerClearedEvent;

/**
 * TimerService class for monitoring and expiring timers
 */
export class TimerService {
  private static readonly CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
  
  private storageService: LocalStorageService;
  private machineService: MachineService;
  private storageEventService: StorageEventService;
  private intervalId: number | null = null;
  private isRunning = false;
  private eventListeners: Map<string, ((event: TimerEvent) => void)[]> = new Map();
  
  // Allow dependency injection for testing
  private setIntervalFn: (callback: () => void, ms: number) => number;
  private clearIntervalFn: (id: number) => void;

  constructor(
    storageService?: LocalStorageService, 
    machineService?: MachineService,
    storageEventService?: StorageEventService,
    setIntervalFn?: (callback: () => void, ms: number) => number,
    clearIntervalFn?: (id: number) => void
  ) {
    this.storageService = storageService || new LocalStorageService();
    this.machineService = machineService || new MachineService(this.storageService);
    this.storageEventService = storageEventService || new StorageEventService(this.storageService);
    this.setIntervalFn = setIntervalFn || ((callback, ms) => window.setInterval(callback, ms));
    this.clearIntervalFn = clearIntervalFn || ((id) => window.clearInterval(id));
  }

  /**
   * Start timer monitoring with setInterval-based checking every 30 seconds
   */
  public startTimerMonitoring(): void {
    if (this.isRunning) {
      console.warn('Timer monitoring is already running');
      return;
    }

    this.isRunning = true;
    
    // Check immediately on start
    this.checkExpiredTimers();
    
    // Set up interval for periodic checking
    this.intervalId = this.setIntervalFn(() => {
      this.checkExpiredTimers();
    }, TimerService.CHECK_INTERVAL_MS);

    console.log('Timer monitoring started - checking every 30 seconds');
  }

  /**
   * Stop timer monitoring
   */
  public stopTimerMonitoring(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId !== null) {
      this.clearIntervalFn(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('Timer monitoring stopped');
  }

  /**
   * Check for expired timers and update machine status
   * Implements requirements 3.1, 3.2, 3.3
   */
  public checkExpiredTimers(): void {
    try {
      const machines = this.storageService.getMachines();
      const now = Math.floor(Date.now() / 1000);
      let hasExpiredTimers = false;

      const updatedMachines: MachineData[] = machines.map(machine => {
        // Check if machine has an expired timer
        if (machine.timerEndTime && machine.timerEndTime <= now) {
          hasExpiredTimers = true;
          
          // Create updated machine without timer (requirement 3.3)
          const updatedMachine: MachineData = {
            ...machine,
            timerEndTime: undefined, // Remove timer data from localStorage
            updatedAt: Date.now()
          };

          // Emit timer expired event
          this.emitTimerExpiredEvent(machine.id, updatedMachine);
          
          console.log(`Timer expired for machine ${machine.id} (${machine.name})`);
          return updatedMachine;
        }

        return machine;
      });

      // Update localStorage if any timers expired (requirement 3.2)
      if (hasExpiredTimers) {
        this.storageService.saveMachines(updatedMachines);
        console.log('Updated localStorage with expired timer changes');
      }

    } catch (error) {
      console.error('Error checking expired timers:', error);
    }
  }

  /**
   * Get machines with active (non-expired) timers
   */
  public getActiveMachines(): MachineStatus[] {
    try {
      return this.machineService.getMachinesWithActiveTimers();
    } catch (error) {
      console.error('Error getting active machines:', error);
      return [];
    }
  }

  /**
   * Get next timer expiration time
   */
  public getNextExpirationTime(): number | null {
    try {
      const machines = this.storageService.getMachines();
      const now = Math.floor(Date.now() / 1000);
      
      let nextExpiration: number | null = null;
      
      for (const machine of machines) {
        if (machine.timerEndTime && machine.timerEndTime > now) {
          if (nextExpiration === null || machine.timerEndTime < nextExpiration) {
            nextExpiration = machine.timerEndTime;
          }
        }
      }
      
      return nextExpiration;
    } catch (error) {
      console.error('Error getting next expiration time:', error);
      return null;
    }
  }

  /**
   * Get time until next timer expiration in milliseconds
   */
  public getTimeUntilNextExpiration(): number | null {
    const nextExpiration = this.getNextExpirationTime();
    if (nextExpiration === null) {
      return null;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = nextExpiration - now;
    return Math.max(0, remainingSeconds * 1000);
  }

  /**
   * Check if timer monitoring is currently running
   */
  public isMonitoringActive(): boolean {
    return this.isRunning;
  }

  /**
   * Add event listener for timer events
   */
  public addEventListener(eventType: TimerEvent['type'], listener: (event: TimerEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType)!;
    listeners.push(listener);
  }

  /**
   * Remove event listener for timer events
   */
  public removeEventListener(eventType: TimerEvent['type'], listener: (event: TimerEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (!listeners) {
      return;
    }

    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Remove all event listeners
   */
  public removeAllEventListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * Emit timer expired event
   */
  private emitTimerExpiredEvent(machineId: number, updatedMachineData: MachineData): void {
    try {
      // Convert to MachineStatus for the event
      const machineStatus: MachineStatus = {
        id: updatedMachineData.id,
        name: updatedMachineData.name,
        status: 'available', // Machine is now available since timer expired
        remainingTimeMs: undefined
      };

      const event: TimerExpiredEvent = {
        type: 'timer_expired',
        machineId,
        machine: machineStatus,
        timestamp: Date.now()
      };

      // Emit to local listeners
      this.emitEvent(event);

      // Broadcast to other tabs (requirement 6.3)
      this.storageEventService.broadcastTimerExpired(machineId, machineStatus);
    } catch (error) {
      console.error('Error emitting timer expired event:', error);
    }
  }

  /**
   * Emit timer set event (called externally when timer is set)
   */
  public emitTimerSetEvent(machineId: number, machine: MachineStatus): void {
    const event: TimerSetEvent = {
      type: 'timer_set',
      machineId,
      machine,
      timestamp: Date.now()
    };

    // Emit to local listeners
    this.emitEvent(event);

    // Broadcast to other tabs (requirement 6.2)
    this.storageEventService.broadcastTimerSet(machineId, machine);
  }

  /**
   * Emit timer cleared event (called externally when timer is cleared)
   */
  public emitTimerClearedEvent(machineId: number, machine: MachineStatus): void {
    const event: TimerClearedEvent = {
      type: 'timer_cleared',
      machineId,
      machine,
      timestamp: Date.now()
    };

    // Emit to local listeners
    this.emitEvent(event);

    // Broadcast to other tabs
    this.storageEventService.broadcastMachineUpdated(machineId, machine);
  }

  /**
   * Emit event to all registered listeners
   */
  private emitEvent(event: TimerEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (!listeners) {
      return;
    }

    // Call all listeners for this event type
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in timer event listener for ${event.type}:`, error);
      }
    });
  }

  /**
   * Get service status for debugging
   */
  public getServiceStatus(): {
    isRunning: boolean;
    intervalId: number | null;
    activeMachineCount: number;
    nextExpirationTime: number | null;
    timeUntilNextExpiration: number | null;
    eventListenerCount: number;
  } {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId,
      activeMachineCount: this.getActiveMachines().length,
      nextExpirationTime: this.getNextExpirationTime(),
      timeUntilNextExpiration: this.getTimeUntilNextExpiration(),
      eventListenerCount: Array.from(this.eventListeners.values()).reduce((total, listeners) => total + listeners.length, 0)
    };
  }

  /**
   * Force check expired timers (for testing or manual trigger)
   */
  public forceCheckExpiredTimers(): void {
    this.checkExpiredTimers();
  }

  /**
   * Cleanup resources when service is no longer needed
   */
  public destroy(): void {
    this.stopTimerMonitoring();
    this.removeAllEventListeners();
  }
}