import { MachineRepository } from '../database/MachineRepository';
import { Machine } from '../models/Machine';
import { MachineStatus, TimerRequest } from '../types';
import { StatusBroadcastService } from './StatusBroadcastService';
import { createLogger } from '../utils/logger';

/**
 * Service class for machine business logic operations
 */
export class MachineService {
  private machineRepository: MachineRepository;
  private logger = createLogger('MachineService');

  constructor(machineRepository?: MachineRepository) {
    this.machineRepository = machineRepository || new MachineRepository();
  }

  /**
   * Get all machines with their current status
   */
  async getAllMachines(): Promise<MachineStatus[]> {
    try {
      const machines = await this.machineRepository.findAll();
      return machines.map(machine => machine.toStatus());
    } catch (error) {
      throw new Error(`Failed to retrieve machines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific machine by ID
   */
  async getMachineById(id: number): Promise<MachineStatus | null> {
    try {
      this.validateMachineId(id);
      
      const machine = await this.machineRepository.findById(id);
      return machine ? machine.toStatus() : null;
    } catch (error) {
      throw new Error(`Failed to retrieve machine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set timer for a machine
   */
  async setTimer(machineId: number, durationMinutes: number): Promise<MachineStatus> {
    try {
      // Validate inputs
      this.validateMachineId(machineId);
      this.validateTimerDuration(durationMinutes);

      // Check if machine exists
      const existingMachine = await this.machineRepository.findById(machineId);
      if (!existingMachine) {
        throw new Error(`Machine with ID ${machineId} not found`);
      }

      // Check if machine is available
      if (!existingMachine.isAvailable()) {
        throw new Error(`Machine ${existingMachine.name} is currently in use`);
      }

      // Set the timer
      const updatedMachine = await this.machineRepository.setTimer(machineId, durationMinutes);
      return updatedMachine.toStatus();
    } catch (error) {
      throw new Error(`Failed to set timer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear timer for a machine (make it available)
   */
  async clearTimer(machineId: number): Promise<MachineStatus> {
    try {
      this.validateMachineId(machineId);

      // Check if machine exists
      const existingMachine = await this.machineRepository.findById(machineId);
      if (!existingMachine) {
        throw new Error(`Machine with ID ${machineId} not found`);
      }

      // Clear the timer
      const updatedMachine = await this.machineRepository.clearTimer(machineId);
      return updatedMachine.toStatus();
    } catch (error) {
      throw new Error(`Failed to clear timer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update machine status
   */
  async updateMachineStatus(machineId: number, status: 'available' | 'in-use', timerEndTime?: number): Promise<MachineStatus> {
    try {
      this.validateMachineId(machineId);
      this.validateMachineStatus(status);

      // Validate status consistency
      if (status === 'in-use' && !timerEndTime) {
        throw new Error('Timer end time is required when setting machine to in-use');
      }
      if (status === 'available' && timerEndTime) {
        throw new Error('Timer end time should not be provided when setting machine to available');
      }

      // Check if machine exists
      const existingMachine = await this.machineRepository.findById(machineId);
      if (!existingMachine) {
        throw new Error(`Machine with ID ${machineId} not found`);
      }

      // Update the status
      const updatedMachine = await this.machineRepository.updateStatus(machineId, status, timerEndTime);
      return updatedMachine.toStatus();
    } catch (error) {
      throw new Error(`Failed to update machine status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get machines that are currently available
   */
  async getAvailableMachines(): Promise<MachineStatus[]> {
    try {
      const machines = await this.machineRepository.findAll();
      const availableMachines = machines.filter(machine => machine.isAvailable());
      return availableMachines.map(machine => machine.toStatus());
    } catch (error) {
      throw new Error(`Failed to retrieve available machines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get machines with active timers
   */
  async getMachinesWithActiveTimers(): Promise<MachineStatus[]> {
    try {
      const machines = await this.machineRepository.findWithActiveTimers();
      // Filter out expired timers
      const activeMachines = machines.filter(machine => !machine.isTimerExpired());
      return activeMachines.map(machine => machine.toStatus());
    } catch (error) {
      throw new Error(`Failed to retrieve machines with active timers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get machines with expired timers
   */
  async getMachinesWithExpiredTimers(): Promise<MachineStatus[]> {
    try {
      const expiredMachines = await this.machineRepository.findWithExpiredTimers();
      return expiredMachines.map(machine => machine.toStatus());
    } catch (error) {
      throw new Error(`Failed to retrieve machines with expired timers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process expired timers and make machines available
   */
  async processExpiredTimers(): Promise<number> {
    try {
      const expiredMachines = await this.machineRepository.findWithExpiredTimers();
      let processedCount = 0;

      this.logger.info('Processing expired timers', { expiredCount: expiredMachines.length });

      for (const machine of expiredMachines) {
        try {
          await this.machineRepository.clearTimer(machine.id);
          processedCount++;
          this.logger.info('Cleared expired timer', { machineId: machine.id, machineName: machine.name });
        } catch (error) {
          // Log error but continue processing other machines
          this.logger.error('Failed to clear timer for machine', error instanceof Error ? error : new Error(String(error)), { machineId: machine.id, machineName: machine.name });
        }
      }

      this.logger.info('Finished processing expired timers', { processedCount, totalExpired: expiredMachines.length });
      return processedCount;
    } catch (error) {
      this.logger.error('Failed to process expired timers', error instanceof Error ? error : new Error(String(error)));
      throw new Error(`Failed to process expired timers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a machine is available for use
   */
  async isMachineAvailable(machineId: number): Promise<boolean> {
    try {
      this.validateMachineId(machineId);

      const machine = await this.machineRepository.findById(machineId);
      if (!machine) {
        return false;
      }

      return machine.isAvailable();
    } catch (error) {
      throw new Error(`Failed to check machine availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get machine usage statistics
   */
  async getMachineStats(): Promise<{ available: number; inUse: number; total: number }> {
    try {
      const counts = await this.machineRepository.getCountByStatus();
      return {
        available: counts.available,
        inUse: counts.inUse,
        total: counts.available + counts.inUse
      };
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
      Machine.validateTimerDuration(durationMinutes);
    } catch (error) {
      throw new Error(`Invalid timer duration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate machine status
   */
  private validateMachineStatus(status: string): void {
    if (!['available', 'in-use'].includes(status)) {
      throw new Error('Machine status must be either "available" or "in-use"');
    }
  }
}