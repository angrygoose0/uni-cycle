import { MachineService } from '../MachineService';
import { MachineRepository } from '../../database/MachineRepository';
import { Machine } from '../../models/Machine';
import { MachineStatus } from '../../types';

// Mock the MachineRepository
jest.mock('../../database/MachineRepository');

describe('MachineService', () => {
  let machineService: MachineService;
  let mockMachineRepository: jest.Mocked<MachineRepository>;

  // Sample test data
  const sampleMachine = new Machine({
    id: 1,
    name: 'Washer 1',
    status: 'available',
    createdAt: 1640995200,
    updatedAt: 1640995200
  });

  const sampleInUseMachine = new Machine({
    id: 2,
    name: 'Washer 2',
    status: 'in-use',
    timerEndTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    createdAt: 1640995200,
    updatedAt: 1640995200
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock repository
    mockMachineRepository = new MachineRepository() as jest.Mocked<MachineRepository>;
    
    // Create service with mock repository
    machineService = new MachineService(mockMachineRepository);
  });

  describe('getAllMachines', () => {
    it('should return all machines as MachineStatus objects', async () => {
      // Arrange
      const machines = [sampleMachine, sampleInUseMachine];
      mockMachineRepository.findAll.mockResolvedValue(machines);

      // Act
      const result = await machineService.getAllMachines();

      // Assert
      expect(mockMachineRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(sampleMachine.toStatus());
      expect(result[1]).toEqual(sampleInUseMachine.toStatus());
    });

    it('should throw error when repository fails', async () => {
      // Arrange
      mockMachineRepository.findAll.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(machineService.getAllMachines()).rejects.toThrow('Failed to retrieve machines: Database error');
    });
  });

  describe('getMachineById', () => {
    it('should return machine status when machine exists', async () => {
      // Arrange
      mockMachineRepository.findById.mockResolvedValue(sampleMachine);

      // Act
      const result = await machineService.getMachineById(1);

      // Assert
      expect(mockMachineRepository.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(sampleMachine.toStatus());
    });

    it('should return null when machine does not exist', async () => {
      // Arrange
      mockMachineRepository.findById.mockResolvedValue(null);

      // Act
      const result = await machineService.getMachineById(999);

      // Assert
      expect(mockMachineRepository.findById).toHaveBeenCalledWith(999);
      expect(result).toBeNull();
    });

    it('should throw error for invalid machine ID', async () => {
      // Act & Assert
      await expect(machineService.getMachineById(0)).rejects.toThrow('Failed to retrieve machine: Machine ID must be a positive integer');
      await expect(machineService.getMachineById(-1)).rejects.toThrow('Failed to retrieve machine: Machine ID must be a positive integer');
      await expect(machineService.getMachineById(1.5)).rejects.toThrow('Failed to retrieve machine: Machine ID must be a positive integer');
    });
  });

  describe('setTimer', () => {
    it('should set timer for available machine', async () => {
      // Arrange
      const updatedMachine = new Machine({
        ...sampleMachine,
        status: 'in-use',
        timerEndTime: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
        updatedAt: Math.floor(Date.now() / 1000)
      });
      
      mockMachineRepository.findById.mockResolvedValue(sampleMachine);
      mockMachineRepository.setTimer.mockResolvedValue(updatedMachine);

      // Act
      const result = await machineService.setTimer(1, 30);

      // Assert
      expect(mockMachineRepository.findById).toHaveBeenCalledWith(1);
      expect(mockMachineRepository.setTimer).toHaveBeenCalledWith(1, 30);
      expect(result).toEqual(updatedMachine.toStatus());
    });

    it('should throw error when machine does not exist', async () => {
      // Arrange
      mockMachineRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(machineService.setTimer(999, 30)).rejects.toThrow('Failed to set timer: Machine with ID 999 not found');
    });

    it('should throw error when machine is already in use', async () => {
      // Arrange
      mockMachineRepository.findById.mockResolvedValue(sampleInUseMachine);

      // Act & Assert
      await expect(machineService.setTimer(2, 30)).rejects.toThrow('Failed to set timer: Machine Washer 2 is currently in use');
    });

    it('should throw error for invalid timer duration', async () => {
      // Act & Assert
      await expect(machineService.setTimer(1, 0)).rejects.toThrow('Failed to set timer: Invalid timer duration: Timer duration must be at least 1 minute');
      await expect(machineService.setTimer(1, 301)).rejects.toThrow('Failed to set timer: Invalid timer duration: Timer duration cannot exceed 300 minutes (5 hours)');
      await expect(machineService.setTimer(1, 1.5)).rejects.toThrow('Failed to set timer: Invalid timer duration: Timer duration must be an integer');
    });

    it('should throw error for invalid machine ID', async () => {
      // Act & Assert
      await expect(machineService.setTimer(0, 30)).rejects.toThrow('Failed to set timer: Machine ID must be a positive integer');
    });
  });

  describe('clearTimer', () => {
    it('should clear timer for machine', async () => {
      // Arrange
      const clearedMachine = new Machine({
        ...sampleInUseMachine,
        status: 'available',
        timerEndTime: undefined,
        updatedAt: Math.floor(Date.now() / 1000)
      });
      
      mockMachineRepository.findById.mockResolvedValue(sampleInUseMachine);
      mockMachineRepository.clearTimer.mockResolvedValue(clearedMachine);

      // Act
      const result = await machineService.clearTimer(2);

      // Assert
      expect(mockMachineRepository.findById).toHaveBeenCalledWith(2);
      expect(mockMachineRepository.clearTimer).toHaveBeenCalledWith(2);
      expect(result).toEqual(clearedMachine.toStatus());
    });

    it('should throw error when machine does not exist', async () => {
      // Arrange
      mockMachineRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(machineService.clearTimer(999)).rejects.toThrow('Failed to clear timer: Machine with ID 999 not found');
    });

    it('should throw error for invalid machine ID', async () => {
      // Act & Assert
      await expect(machineService.clearTimer(-1)).rejects.toThrow('Failed to clear timer: Machine ID must be a positive integer');
    });
  });

  describe('updateMachineStatus', () => {
    it('should update machine status to available', async () => {
      // Arrange
      const updatedMachine = new Machine({
        ...sampleInUseMachine,
        status: 'available',
        timerEndTime: undefined,
        updatedAt: Math.floor(Date.now() / 1000)
      });
      
      mockMachineRepository.findById.mockResolvedValue(sampleInUseMachine);
      mockMachineRepository.updateStatus.mockResolvedValue(updatedMachine);

      // Act
      const result = await machineService.updateMachineStatus(2, 'available');

      // Assert
      expect(mockMachineRepository.findById).toHaveBeenCalledWith(2);
      expect(mockMachineRepository.updateStatus).toHaveBeenCalledWith(2, 'available', undefined);
      expect(result).toEqual(updatedMachine.toStatus());
    });

    it('should update machine status to in-use with timer', async () => {
      // Arrange
      const timerEndTime = Math.floor(Date.now() / 1000) + 1800;
      const updatedMachine = new Machine({
        ...sampleMachine,
        status: 'in-use',
        timerEndTime,
        updatedAt: Math.floor(Date.now() / 1000)
      });
      
      mockMachineRepository.findById.mockResolvedValue(sampleMachine);
      mockMachineRepository.updateStatus.mockResolvedValue(updatedMachine);

      // Act
      const result = await machineService.updateMachineStatus(1, 'in-use', timerEndTime);

      // Assert
      expect(mockMachineRepository.findById).toHaveBeenCalledWith(1);
      expect(mockMachineRepository.updateStatus).toHaveBeenCalledWith(1, 'in-use', timerEndTime);
      expect(result).toEqual(updatedMachine.toStatus());
    });

    it('should throw error when setting in-use without timer', async () => {
      // Act & Assert
      await expect(machineService.updateMachineStatus(1, 'in-use')).rejects.toThrow('Failed to update machine status: Timer end time is required when setting machine to in-use');
    });

    it('should throw error when setting available with timer', async () => {
      // Act & Assert
      await expect(machineService.updateMachineStatus(1, 'available', 123456)).rejects.toThrow('Failed to update machine status: Timer end time should not be provided when setting machine to available');
    });

    it('should throw error for invalid status', async () => {
      // Act & Assert
      await expect(machineService.updateMachineStatus(1, 'invalid' as any)).rejects.toThrow('Failed to update machine status: Machine status must be either "available" or "in-use"');
    });
  });

  describe('getAvailableMachines', () => {
    it('should return only available machines', async () => {
      // Arrange
      const expiredMachine = new Machine({
        id: 3,
        name: 'Washer 3',
        status: 'in-use',
        timerEndTime: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        createdAt: 1640995200,
        updatedAt: 1640995200
      });
      
      const machines = [sampleMachine, sampleInUseMachine, expiredMachine];
      mockMachineRepository.findAll.mockResolvedValue(machines);

      // Act
      const result = await machineService.getAvailableMachines();

      // Assert
      expect(result).toHaveLength(2); // sampleMachine and expiredMachine (which is available due to expired timer)
      expect(result.map(m => m.id)).toContain(1); // sampleMachine
      expect(result.map(m => m.id)).toContain(3); // expiredMachine
      expect(result.map(m => m.id)).not.toContain(2); // sampleInUseMachine (still in use)
    });
  });

  describe('getMachinesWithActiveTimers', () => {
    it('should return only machines with active (non-expired) timers', async () => {
      // Arrange
      const expiredMachine = new Machine({
        id: 3,
        name: 'Washer 3',
        status: 'in-use',
        timerEndTime: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        createdAt: 1640995200,
        updatedAt: 1640995200
      });
      
      const machines = [sampleInUseMachine, expiredMachine];
      mockMachineRepository.findWithActiveTimers.mockResolvedValue(machines);

      // Act
      const result = await machineService.getMachinesWithActiveTimers();

      // Assert
      expect(result).toHaveLength(1); // Only sampleInUseMachine has active timer
      expect(result[0].id).toBe(2);
    });
  });

  describe('processExpiredTimers', () => {
    it('should process all expired timers', async () => {
      // Arrange
      const expiredMachine1 = new Machine({
        id: 3,
        name: 'Washer 3',
        status: 'in-use',
        timerEndTime: Math.floor(Date.now() / 1000) - 3600,
        createdAt: 1640995200,
        updatedAt: 1640995200
      });
      
      const expiredMachine2 = new Machine({
        id: 4,
        name: 'Washer 4',
        status: 'in-use',
        timerEndTime: Math.floor(Date.now() / 1000) - 1800,
        createdAt: 1640995200,
        updatedAt: 1640995200
      });
      
      mockMachineRepository.findWithExpiredTimers.mockResolvedValue([expiredMachine1, expiredMachine2]);
      mockMachineRepository.clearTimer.mockResolvedValue(sampleMachine);

      // Act
      const result = await machineService.processExpiredTimers();

      // Assert
      expect(mockMachineRepository.findWithExpiredTimers).toHaveBeenCalledTimes(1);
      expect(mockMachineRepository.clearTimer).toHaveBeenCalledTimes(2);
      expect(mockMachineRepository.clearTimer).toHaveBeenCalledWith(3);
      expect(mockMachineRepository.clearTimer).toHaveBeenCalledWith(4);
      expect(result).toBe(2);
    });

    it('should continue processing even if one machine fails', async () => {
      // Arrange
      const expiredMachine1 = new Machine({
        id: 3,
        name: 'Washer 3',
        status: 'in-use',
        timerEndTime: Math.floor(Date.now() / 1000) - 3600,
        createdAt: 1640995200,
        updatedAt: 1640995200
      });
      
      const expiredMachine2 = new Machine({
        id: 4,
        name: 'Washer 4',
        status: 'in-use',
        timerEndTime: Math.floor(Date.now() / 1000) - 1800,
        createdAt: 1640995200,
        updatedAt: 1640995200
      });
      
      mockMachineRepository.findWithExpiredTimers.mockResolvedValue([expiredMachine1, expiredMachine2]);
      mockMachineRepository.clearTimer
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(sampleMachine);

      // Mock console.error to avoid test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await machineService.processExpiredTimers();

      // Assert
      expect(result).toBe(1); // Only one succeeded
      expect(consoleSpy).toHaveBeenCalledWith('Failed to clear timer for machine 3: Database error');
      
      // Cleanup
      consoleSpy.mockRestore();
    });
  });

  describe('isMachineAvailable', () => {
    it('should return true for available machine', async () => {
      // Arrange
      mockMachineRepository.findById.mockResolvedValue(sampleMachine);

      // Act
      const result = await machineService.isMachineAvailable(1);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for machine in use', async () => {
      // Arrange
      mockMachineRepository.findById.mockResolvedValue(sampleInUseMachine);

      // Act
      const result = await machineService.isMachineAvailable(2);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for non-existent machine', async () => {
      // Arrange
      mockMachineRepository.findById.mockResolvedValue(null);

      // Act
      const result = await machineService.isMachineAvailable(999);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getMachineStats', () => {
    it('should return machine statistics', async () => {
      // Arrange
      const stats = { available: 3, inUse: 2 };
      mockMachineRepository.getCountByStatus.mockResolvedValue(stats);

      // Act
      const result = await machineService.getMachineStats();

      // Assert
      expect(mockMachineRepository.getCountByStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        available: 3,
        inUse: 2,
        total: 5
      });
    });
  });
});