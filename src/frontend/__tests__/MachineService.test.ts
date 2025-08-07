/**
 * Unit tests for frontend MachineService
 * Tests business logic with mocked LocalStorageService
 */

import { MachineService } from '../MachineService';
import { LocalStorageService, MachineData } from '../LocalStorageService';
import { MachineStatus } from '../types';

// Mock LocalStorageService
jest.mock('../LocalStorageService');

describe('MachineService', () => {
  let machineService: MachineService;
  let mockStorageService: jest.Mocked<LocalStorageService>;
  let mockMachineData: MachineData[];

  const createMockMachineData = (): MachineData[] => {
    const now = 2000000; // Fixed timestamp for consistent testing
    return [
      {
        id: 1,
        name: 'Washer 1',
        createdAt: 1000000,
        updatedAt: 1000000
      },
      {
        id: 2,
        name: 'Dryer 1',
        timerEndTime: now + 3600, // 1 hour from fixed now
        createdAt: 1000000,
        updatedAt: 1000000
      },
      {
        id: 3,
        name: 'Washer 2',
        timerEndTime: now - 3600, // 1 hour ago from fixed now (expired)
        createdAt: 1000000,
        updatedAt: 1000000
      }
    ];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Date.now to return consistent timestamp (2000000 seconds = 2000000000 milliseconds)
    jest.spyOn(Date, 'now').mockReturnValue(2000000 * 1000);
    
    // Reset mock data for each test
    mockMachineData = createMockMachineData();
    
    // Create mock storage service
    mockStorageService = new LocalStorageService() as jest.Mocked<LocalStorageService>;
    
    // Setup default mock implementations
    mockStorageService.getMachines.mockReturnValue([...mockMachineData]);
    mockStorageService.getMachineById.mockImplementation((id: number) => 
      mockMachineData.find(m => m.id === id) || null
    );
    mockStorageService.updateMachine.mockImplementation((machine: MachineData) => {
      // Simulate updating the machine in the mock data
      const index = mockMachineData.findIndex(m => m.id === machine.id);
      if (index !== -1) {
        mockMachineData[index] = machine;
      }
    });
    mockStorageService.resetToDefaults.mockImplementation(() => {});

    machineService = new MachineService(mockStorageService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with provided storage service', () => {
      const service = new MachineService(mockStorageService);
      expect(service).toBeInstanceOf(MachineService);
    });

    it('should create instance with default storage service when none provided', () => {
      const service = new MachineService();
      expect(service).toBeInstanceOf(MachineService);
    });
  });

  describe('initializeDefaultMachines', () => {
    it('should not reset when machines exist', () => {
      mockStorageService.getMachines.mockReturnValue(mockMachineData);
      
      machineService.initializeDefaultMachines();
      
      expect(mockStorageService.getMachines).toHaveBeenCalled();
      expect(mockStorageService.resetToDefaults).not.toHaveBeenCalled();
    });

    it('should reset to defaults when no machines exist', () => {
      mockStorageService.getMachines.mockReturnValue([]);
      
      machineService.initializeDefaultMachines();
      
      expect(mockStorageService.getMachines).toHaveBeenCalled();
      expect(mockStorageService.resetToDefaults).toHaveBeenCalled();
    });

    it('should throw error when storage fails', () => {
      mockStorageService.getMachines.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.initializeDefaultMachines()).toThrow('Failed to initialize default machines: Storage error');
    });
  });

  describe('getAllMachines', () => {
    it('should return all machines with correct status', () => {
      const machines = machineService.getAllMachines();
      
      expect(machines).toHaveLength(3);
      expect(machines[0]).toEqual({
        id: 1,
        name: 'Washer 1',
        status: 'available'
      });
      expect(machines[1]).toEqual({
        id: 2,
        name: 'Dryer 1',
        status: 'in-use',
        remainingTimeMs: expect.any(Number)
      });
      expect(machines[2]).toEqual({
        id: 3,
        name: 'Washer 2',
        status: 'available' // Expired timer should show as available
      });
    });

    it('should throw error when storage fails', () => {
      mockStorageService.getMachines.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.getAllMachines()).toThrow('Failed to retrieve machines: Storage error');
    });
  });

  describe('getMachineById', () => {
    it('should return machine when found', () => {
      const machine = machineService.getMachineById(1);
      
      expect(machine).toEqual({
        id: 1,
        name: 'Washer 1',
        status: 'available'
      });
    });

    it('should return null when machine not found', () => {
      mockStorageService.getMachineById.mockReturnValue(null);
      
      const machine = machineService.getMachineById(999);
      
      expect(machine).toBeNull();
    });

    it('should validate machine ID', () => {
      expect(() => machineService.getMachineById(0)).toThrow('Machine ID must be a positive integer');
      expect(() => machineService.getMachineById(-1)).toThrow('Machine ID must be a positive integer');
      expect(() => machineService.getMachineById(1.5)).toThrow('Machine ID must be a positive integer');
    });

    it('should throw error when storage fails', () => {
      mockStorageService.getMachineById.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.getMachineById(1)).toThrow('Failed to retrieve machine: Storage error');
    });
  });

  describe('setTimer', () => {

    it('should set timer for available machine', () => {
      const result = machineService.setTimer(1, 60);
      
      expect(result).toEqual({
        id: 1,
        name: 'Washer 1',
        status: 'in-use',
        remainingTimeMs: 60 * 60 * 1000 // 60 minutes in milliseconds
      });
      
      expect(mockStorageService.updateMachine).toHaveBeenCalledWith({
        id: 1,
        name: 'Washer 1',
        timerEndTime: 2000000 + (60 * 60), // Current time + 60 minutes
        createdAt: 1000000,
        updatedAt: 2000000
      });
    });

    it('should allow timer override for machine with existing timer', () => {
      const result = machineService.setTimer(2, 30);
      
      expect(result).toEqual({
        id: 2,
        name: 'Dryer 1',
        status: 'in-use',
        remainingTimeMs: 30 * 60 * 1000 // 30 minutes in milliseconds
      });
      
      expect(mockStorageService.updateMachine).toHaveBeenCalled();
    });

    it('should validate machine ID', () => {
      expect(() => machineService.setTimer(0, 60)).toThrow('Machine ID must be a positive integer');
      expect(() => machineService.setTimer(-1, 60)).toThrow('Machine ID must be a positive integer');
      expect(() => machineService.setTimer(1.5, 60)).toThrow('Machine ID must be a positive integer');
    });

    it('should validate timer duration', () => {
      expect(() => machineService.setTimer(1, 0)).toThrow('Invalid timer duration: Timer duration must be at least 1 minute');
      expect(() => machineService.setTimer(1, -1)).toThrow('Invalid timer duration: Timer duration must be at least 1 minute');
      expect(() => machineService.setTimer(1, 121)).toThrow('Invalid timer duration: Timer duration cannot exceed 120 minutes (2 hours)');
      expect(() => machineService.setTimer(1, 1.5)).toThrow('Invalid timer duration: Timer duration must be an integer');
    });

    it('should throw error when machine not found', () => {
      mockStorageService.getMachineById.mockReturnValue(null);
      
      expect(() => machineService.setTimer(999, 60)).toThrow('Failed to set timer: Machine with ID 999 not found');
    });

    it('should throw error when storage fails', () => {
      mockStorageService.updateMachine.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.setTimer(1, 60)).toThrow('Failed to set timer: Storage error');
    });
  });

  describe('clearTimer', () => {

    it('should clear timer for machine', () => {
      const result = machineService.clearTimer(2);
      
      expect(result).toEqual({
        id: 2,
        name: 'Dryer 1',
        status: 'available'
      });
      
      expect(mockStorageService.updateMachine).toHaveBeenCalledWith({
        id: 2,
        name: 'Dryer 1',
        timerEndTime: undefined,
        createdAt: 1000000,
        updatedAt: 2000000
      });
    });

    it('should validate machine ID', () => {
      expect(() => machineService.clearTimer(0)).toThrow('Machine ID must be a positive integer');
      expect(() => machineService.clearTimer(-1)).toThrow('Machine ID must be a positive integer');
      expect(() => machineService.clearTimer(1.5)).toThrow('Machine ID must be a positive integer');
    });

    it('should throw error when machine not found', () => {
      mockStorageService.getMachineById.mockReturnValue(null);
      
      expect(() => machineService.clearTimer(999)).toThrow('Failed to clear timer: Machine with ID 999 not found');
    });

    it('should throw error when storage fails', () => {
      mockStorageService.updateMachine.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.clearTimer(2)).toThrow('Failed to clear timer: Storage error');
    });
  });

  describe('getAvailableMachines', () => {
    it('should return only available machines', () => {
      const machines = machineService.getAvailableMachines();
      
      expect(machines).toHaveLength(2);
      expect(machines.map(m => m.id)).toEqual([1, 3]); // Machine 1 (no timer) and 3 (expired timer)
      expect(machines.every(m => m.status === 'available')).toBe(true);
    });

    it('should throw error when storage fails', () => {
      mockStorageService.getMachines.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.getAvailableMachines()).toThrow('Failed to retrieve available machines: Storage error');
    });
  });

  describe('getMachinesWithActiveTimers', () => {
    it('should return only machines with active (non-expired) timers', () => {
      const machines = machineService.getMachinesWithActiveTimers();
      
      expect(machines).toHaveLength(1);
      expect(machines[0].id).toBe(2); // Only machine 2 has active timer
      expect(machines[0].status).toBe('in-use');
    });

    it('should throw error when storage fails', () => {
      mockStorageService.getMachines.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.getMachinesWithActiveTimers()).toThrow('Failed to retrieve machines with active timers: Storage error');
    });
  });

  describe('isMachineAvailable', () => {
    it('should return true for available machine', () => {
      const isAvailable = machineService.isMachineAvailable(1);
      expect(isAvailable).toBe(true);
    });

    it('should return false for machine with active timer', () => {
      const isAvailable = machineService.isMachineAvailable(2);
      expect(isAvailable).toBe(false);
    });

    it('should return true for machine with expired timer', () => {
      const isAvailable = machineService.isMachineAvailable(3);
      expect(isAvailable).toBe(true);
    });

    it('should return false for non-existent machine', () => {
      mockStorageService.getMachineById.mockReturnValue(null);
      
      const isAvailable = machineService.isMachineAvailable(999);
      expect(isAvailable).toBe(false);
    });

    it('should validate machine ID', () => {
      expect(() => machineService.isMachineAvailable(0)).toThrow('Machine ID must be a positive integer');
      expect(() => machineService.isMachineAvailable(-1)).toThrow('Machine ID must be a positive integer');
      expect(() => machineService.isMachineAvailable(1.5)).toThrow('Machine ID must be a positive integer');
    });

    it('should throw error when storage fails', () => {
      mockStorageService.getMachineById.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.isMachineAvailable(1)).toThrow('Failed to check machine availability: Storage error');
    });
  });

  describe('getMachineStats', () => {
    it('should return correct statistics', () => {
      const stats = machineService.getMachineStats();
      
      expect(stats).toEqual({
        available: 2, // Machines 1 and 3 (expired timer)
        inUse: 1,     // Machine 2
        total: 3
      });
    });

    it('should throw error when storage fails', () => {
      mockStorageService.getMachines.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => machineService.getMachineStats()).toThrow('Failed to retrieve machine statistics: Storage error');
    });
  });

  describe('FrontendMachine class (internal)', () => {
    it('should calculate remaining time correctly', () => {
      const now = 2000000; // Use the same fixed timestamp as in our mock
      const machineData: MachineData = {
        id: 1,
        name: 'Test Machine',
        timerEndTime: now + 3600, // 1 hour from now
        createdAt: now - 1000,
        updatedAt: now
      };

      // We can't directly test FrontendMachine, but we can verify the behavior through MachineService
      mockStorageService.getMachines.mockReturnValue([machineData]);
      
      const result = machineService.getAllMachines();
      expect(result[0].remainingTimeMs).toBe(3600000); // Exactly 1 hour in milliseconds
    });

    it('should handle timer validation correctly', () => {
      // Test through setTimer method
      expect(() => machineService.setTimer(1, 0)).toThrow('Timer duration must be at least 1 minute');
      expect(() => machineService.setTimer(1, 121)).toThrow('Timer duration cannot exceed 120 minutes');
      expect(() => machineService.setTimer(1, 1.5)).toThrow('Timer duration must be an integer');
    });
  });
});