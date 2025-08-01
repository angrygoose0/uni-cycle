import { MachineService } from './MachineService';
import { StatusBroadcastService } from './StatusBroadcastService';
import { MachineStatus } from '../types';
import { createLogger } from '../utils/logger';

/**
 * Timer management system for handling machine timers
 */
export class TimerManager {
  private machineService: MachineService;
  private statusBroadcastService: StatusBroadcastService | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private logger = createLogger('TimerManager');

  constructor(machineService?: MachineService, statusBroadcastService?: StatusBroadcastService) {
    this.machineService = machineService || new MachineService();
    this.statusBroadcastService = statusBroadcastService || null;
  }

  /**
   * Start the timer management system with automatic cleanup
   */
  start(intervalMs: number = 30000): void {
    if (this.isRunning) {
      this.logger.warn('TimerManager is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info(`Starting TimerManager with ${intervalMs}ms interval`);

    // Process expired timers immediately
    this.processExpiredTimers().catch(error => {
      this.logger.error('Error during initial timer processing', error instanceof Error ? error : new Error(String(error)));
    });

    // Set up periodic processing
    this.intervalId = setInterval(async () => {
      try {
        await this.processExpiredTimers();
      } catch (error) {
        this.logger.error('Error processing expired timers', error instanceof Error ? error : new Error(String(error)));
      }
    }, intervalMs);
  }

  /**
   * Stop the timer management system
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('TimerManager is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.logger.info('TimerManager stopped');
  }

  /**
   * Check if the timer manager is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Process all expired timers and make machines available
   */
  async processExpiredTimers(): Promise<number> {
    try {
      // Get machines with expired timers before processing
      const expiredMachines = await this.machineService.getMachinesWithExpiredTimers();
      
      const processedCount = await this.machineService.processExpiredTimers();
      
      if (processedCount > 0) {
        this.logger.info(`Processed ${processedCount} expired timer(s)`, { processedCount, expiredMachines: expiredMachines.length });
        
        // Broadcast timer expiration events for each processed machine
        if (this.statusBroadcastService && expiredMachines.length > 0) {
          for (const machine of expiredMachines) {
            // Get updated machine status after processing
            const updatedMachine = await this.machineService.getMachineById(machine.id);
            if (updatedMachine) {
              this.statusBroadcastService.broadcastTimerExpired(machine.id, updatedMachine);
            }
          }
        }
      }

      return processedCount;
    } catch (error) {
      this.logger.error('Failed to process expired timers', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get all machines with active timers
   */
  async getActiveTimers(): Promise<MachineStatus[]> {
    try {
      return await this.machineService.getMachinesWithActiveTimers();
    } catch (error) {
      this.logger.error('Failed to get active timers', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Set a timer for a specific machine
   */
  async setTimer(machineId: number, durationMinutes: number): Promise<MachineStatus> {
    try {
      return await this.machineService.setTimer(machineId, durationMinutes);
    } catch (error) {
      this.logger.error('Failed to set timer for machine', error instanceof Error ? error : new Error(String(error)), { machineId, durationMinutes });
      throw error;
    }
  }

  /**
   * Clear a timer for a specific machine
   */
  async clearTimer(machineId: number): Promise<MachineStatus> {
    try {
      return await this.machineService.clearTimer(machineId);
    } catch (error) {
      this.logger.error('Failed to clear timer for machine', error instanceof Error ? error : new Error(String(error)), { machineId });
      throw error;
    }
  }

  /**
   * Get timer statistics
   */
  async getTimerStats(): Promise<{
    activeTimers: number;
    availableMachines: number;
    totalMachines: number;
  }> {
    try {
      const [activeTimers, stats] = await Promise.all([
        this.getActiveTimers(),
        this.machineService.getMachineStats()
      ]);

      return {
        activeTimers: activeTimers.length,
        availableMachines: stats.available,
        totalMachines: stats.total
      };
    } catch (error) {
      this.logger.error('Failed to get timer statistics', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get remaining time for a specific machine
   */
  async getRemainingTime(machineId: number): Promise<number> {
    try {
      const machine = await this.machineService.getMachineById(machineId);
      if (!machine) {
        throw new Error(`Machine with ID ${machineId} not found`);
      }

      return machine.remainingTimeMs || 0;
    } catch (error) {
      this.logger.error('Failed to get remaining time for machine', error instanceof Error ? error : new Error(String(error)), { machineId });
      throw error;
    }
  }

  /**
   * Check if a machine's timer has expired
   */
  async isTimerExpired(machineId: number): Promise<boolean> {
    try {
      const remainingTime = await this.getRemainingTime(machineId);
      return remainingTime <= 0;
    } catch (error) {
      this.logger.error('Failed to check timer expiration for machine', error instanceof Error ? error : new Error(String(error)), { machineId });
      throw error;
    }
  }

  /**
   * Get next timer to expire
   */
  async getNextExpiration(): Promise<{ machineId: number; remainingTimeMs: number } | null> {
    try {
      const activeTimers = await this.getActiveTimers();
      
      if (activeTimers.length === 0) {
        return null;
      }

      // Find the timer with the least remaining time
      const nextTimer = activeTimers.reduce((next, current) => {
        const currentRemaining = current.remainingTimeMs || 0;
        const nextRemaining = next.remainingTimeMs || 0;
        
        return currentRemaining < nextRemaining ? current : next;
      });

      return {
        machineId: nextTimer.id,
        remainingTimeMs: nextTimer.remainingTimeMs || 0
      };
    } catch (error) {
      this.logger.error('Failed to get next expiration', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Cleanup method to ensure proper shutdown
   */
  cleanup(): void {
    this.stop();
  }
}