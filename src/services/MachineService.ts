import { MachineRepository } from '../database/MachineRepository';
import { ActionLogRepository } from '../database/ActionLogRepository';
import { Machine } from '../models/Machine';
import { MachineStatus, TimerRequest } from '../types';
import { StatusBroadcastService } from './StatusBroadcastService';
import { createLogger } from '../utils/logger';

/**
 * Service class for machine business logic operations
 */
export class MachineService {
  private machineRepository: MachineRepository;
  private actionLogRepository: ActionLogRepository;
  private logger = createLogger('MachineService');

  constructor(machineRepository?: MachineRepository, actionLogRepository?: ActionLogRepository) {
    this.machineRepository = machineRepository || new MachineRepository();
    this.actionLogRepository = actionLogRepository || new ActionLogRepository();
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

      // Allow timer override - no need to check if machine is available

      // Set the timer
      const updatedMachine = await this.machineRepository.setTimer(machineId, durationMinutes);

      // Log the action
      await this.logAction(machineId, existingMachine.name, 'set_timer', durationMinutes);

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

      // Log the action
      await this.logAction(machineId, existingMachine.name, 'clear_timer');

      return updatedMachine.toStatus();
    } catch (error) {
      throw new Error(`Failed to clear timer: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  /**
   * Log an action to the database
   */
  private async logAction(
    machineId: number, 
    machineName: string, 
    actionType: 'set_timer' | 'clear_timer' | 'timer_expired', 
    durationMinutes?: number
  ): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      await this.actionLogRepository.create({
        machineId,
        machineName,
        actionType,
        durationMinutes,
        timestamp: now,
        createdAt: now
      });
      
      this.logger.info(`Action logged: ${actionType} for machine ${machineName} (ID: ${machineId})${durationMinutes ? ` - ${durationMinutes} minutes` : ''}`);
    } catch (error) {
      // Log the error but don't throw it - we don't want logging failures to break the main functionality
      this.logger.error(`Failed to log action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get action logs for a specific machine
   */
  async getMachineActionLogs(machineId: number, limit?: number): Promise<any[]> {
    try {
      this.validateMachineId(machineId);
      const logs = await this.actionLogRepository.findByMachineId(machineId, limit);
      return logs.map(log => ({
        id: log.id,
        machineId: log.machineId,
        machineName: log.machineName,
        actionType: log.actionType,
        durationMinutes: log.durationMinutes,
        timestamp: log.timestamp,
        formattedTimestamp: log.getFormattedTimestamp(),
        description: log.getActionDescription()
      }));
    } catch (error) {
      throw new Error(`Failed to retrieve action logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent action logs across all machines
   */
  async getRecentActionLogs(limit?: number): Promise<any[]> {
    try {
      const logs = await this.actionLogRepository.findAll(limit);
      return logs.map(log => ({
        id: log.id,
        machineId: log.machineId,
        machineName: log.machineName,
        actionType: log.actionType,
        durationMinutes: log.durationMinutes,
        timestamp: log.timestamp,
        formattedTimestamp: log.getFormattedTimestamp(),
        description: log.getActionDescription()
      }));
    } catch (error) {
      throw new Error(`Failed to retrieve recent action logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get action log statistics
   */
  async getActionLogStats(): Promise<{
    total: number;
    setTimerCount: number;
    clearTimerCount: number;
    expiredTimerCount: number;
    todayCount: number;
  }> {
    try {
      return await this.actionLogRepository.getStats();
    } catch (error) {
      throw new Error(`Failed to retrieve action log statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}