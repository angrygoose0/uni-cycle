import { TimerManager } from '../TimerManager';
import { MachineService } from '../MachineService';
import { MachineStatus } from '../../types';

// Mock MachineService
jest.mock('../MachineService');
const MockedMachineService = MachineService as jest.MockedClass<typeof MachineService>;

describe('TimerManager', () => {
  let timerManager: TimerManager;
  let mockMachineService: jest.Mocked<MachineService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockMachineService = new MockedMachineService() as jest.Mocked<MachineService>;
    timerManager = new TimerManager(mockMachineService);
  });

  afterEach(() => {
    timerManager.cleanup();
    jest.useRealTimers();
  });

  describe('start and stop', () => {
    it('should start the timer manager', async () => {
      mockMachineService.getMachinesWithExpiredTimers.mockResolvedValue([]);
      mockMachineService.processExpiredTimers.mockResolvedValue(0);

      timerManager.start(1000);

      expect(timerManager.isActive()).toBe(true);
      // Wait for the initial processExpiredTimers call to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockMachineService.getMachinesWithExpiredTimers).toHaveBeenCalledTimes(1);
      expect(mockMachineService.processExpiredTimers).toHaveBeenCalledTimes(1);
    });

    it('should not start if already running', () => {
      mockMachineService.processExpiredTimers.mockResolvedValue(0);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      timerManager.start(1000);
      timerManager.start(1000);

      expect(consoleSpy).toHaveBeenCalledWith('TimerManager is already running');
      consoleSpy.mockRestore();
    });

    it('should stop the timer manager', () => {
      mockMachineService.processExpiredTimers.mockResolvedValue(0);
      
      timerManager.start(1000);
      expect(timerManager.isActive()).toBe(true);

      timerManager.stop();
      expect(timerManager.isActive()).toBe(false);
    });

    it('should not stop if not running', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      timerManager.stop();

      expect(consoleSpy).toHaveBeenCalledWith('TimerManager is not running');
      consoleSpy.mockRestore();
    });

    it('should process expired timers periodically', async () => {
      mockMachineService.getMachinesWithExpiredTimers.mockResolvedValue([]);
      mockMachineService.processExpiredTimers.mockResolvedValue(1);

      timerManager.start(1000);

      // Fast-forward time
      jest.advanceTimersByTime(2000);

      // Should have been called initially + 2 more times
      expect(mockMachineService.getMachinesWithExpiredTimers).toHaveBeenCalledTimes(3);
      expect(mockMachineService.processExpiredTimers).toHaveBeenCalledTimes(3);
    });
  });

  describe('processExpiredTimers', () => {
    it('should process expired timers successfully', async () => {
      mockMachineService.processExpiredTimers.mockResolvedValue(2);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await timerManager.processExpiredTimers();

      expect(result).toBe(2);
      expect(mockMachineService.processExpiredTimers).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('Processed 2 expired timer(s)');
      
      consoleSpy.mockRestore();
    });

    it('should handle errors during processing', async () => {
      const error = new Error('Processing failed');
      mockMachineService.processExpiredTimers.mockRejectedValue(error);

      await expect(timerManager.processExpiredTimers()).rejects.toThrow('Processing failed');
    });

    it('should not log when no timers are processed', async () => {
      mockMachineService.processExpiredTimers.mockResolvedValue(0);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await timerManager.processExpiredTimers();

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getActiveTimers', () => {
    it('should return active timers', async () => {
      const mockTimers: MachineStatus[] = [
        { id: 1, name: 'Washer 1', status: 'in-use', remainingTimeMs: 30000 },
        { id: 2, name: 'Dryer 1', status: 'in-use', remainingTimeMs: 60000 }
      ];
      mockMachineService.getMachinesWithActiveTimers.mockResolvedValue(mockTimers);

      const result = await timerManager.getActiveTimers();

      expect(result).toEqual(mockTimers);
      expect(mockMachineService.getMachinesWithActiveTimers).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when getting active timers', async () => {
      const error = new Error('Database error');
      mockMachineService.getMachinesWithActiveTimers.mockRejectedValue(error);

      await expect(timerManager.getActiveTimers()).rejects.toThrow('Database error');
    });
  });

  describe('setTimer', () => {
    it('should set timer for a machine', async () => {
      const mockMachine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'in-use',
        remainingTimeMs: 30000
      };
      mockMachineService.setTimer.mockResolvedValue(mockMachine);

      const result = await timerManager.setTimer(1, 30);

      expect(result).toEqual(mockMachine);
      expect(mockMachineService.setTimer).toHaveBeenCalledWith(1, 30);
    });

    it('should handle errors when setting timer', async () => {
      const error = new Error('Machine not found');
      mockMachineService.setTimer.mockRejectedValue(error);

      await expect(timerManager.setTimer(1, 30)).rejects.toThrow('Machine not found');
    });
  });

  describe('clearTimer', () => {
    it('should clear timer for a machine', async () => {
      const mockMachine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'available'
      };
      mockMachineService.clearTimer.mockResolvedValue(mockMachine);

      const result = await timerManager.clearTimer(1);

      expect(result).toEqual(mockMachine);
      expect(mockMachineService.clearTimer).toHaveBeenCalledWith(1);
    });

    it('should handle errors when clearing timer', async () => {
      const error = new Error('Machine not found');
      mockMachineService.clearTimer.mockRejectedValue(error);

      await expect(timerManager.clearTimer(1)).rejects.toThrow('Machine not found');
    });
  });

  describe('getTimerStats', () => {
    it('should return timer statistics', async () => {
      const mockActiveTimers: MachineStatus[] = [
        { id: 1, name: 'Washer 1', status: 'in-use', remainingTimeMs: 30000 }
      ];
      const mockStats = { available: 2, inUse: 1, total: 3 };

      mockMachineService.getMachinesWithActiveTimers.mockResolvedValue(mockActiveTimers);
      mockMachineService.getMachineStats.mockResolvedValue(mockStats);

      const result = await timerManager.getTimerStats();

      expect(result).toEqual({
        activeTimers: 1,
        availableMachines: 2,
        totalMachines: 3
      });
    });

    it('should handle errors when getting statistics', async () => {
      const error = new Error('Database error');
      mockMachineService.getMachinesWithActiveTimers.mockRejectedValue(error);

      await expect(timerManager.getTimerStats()).rejects.toThrow('Database error');
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time for a machine', async () => {
      const mockMachine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'in-use',
        remainingTimeMs: 45000
      };
      mockMachineService.getMachineById.mockResolvedValue(mockMachine);

      const result = await timerManager.getRemainingTime(1);

      expect(result).toBe(45000);
      expect(mockMachineService.getMachineById).toHaveBeenCalledWith(1);
    });

    it('should return 0 for machine without timer', async () => {
      const mockMachine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'available'
      };
      mockMachineService.getMachineById.mockResolvedValue(mockMachine);

      const result = await timerManager.getRemainingTime(1);

      expect(result).toBe(0);
    });

    it('should throw error for non-existent machine', async () => {
      mockMachineService.getMachineById.mockResolvedValue(null);

      await expect(timerManager.getRemainingTime(999)).rejects.toThrow('Machine with ID 999 not found');
    });
  });

  describe('isTimerExpired', () => {
    it('should return true for expired timer', async () => {
      const mockMachine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'available'
      };
      mockMachineService.getMachineById.mockResolvedValue(mockMachine);

      const result = await timerManager.isTimerExpired(1);

      expect(result).toBe(true);
    });

    it('should return false for active timer', async () => {
      const mockMachine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'in-use',
        remainingTimeMs: 30000
      };
      mockMachineService.getMachineById.mockResolvedValue(mockMachine);

      const result = await timerManager.isTimerExpired(1);

      expect(result).toBe(false);
    });
  });

  describe('getNextExpiration', () => {
    it('should return next timer to expire', async () => {
      const mockTimers: MachineStatus[] = [
        { id: 1, name: 'Washer 1', status: 'in-use', remainingTimeMs: 60000 },
        { id: 2, name: 'Dryer 1', status: 'in-use', remainingTimeMs: 30000 },
        { id: 3, name: 'Washer 2', status: 'in-use', remainingTimeMs: 90000 }
      ];
      mockMachineService.getMachinesWithActiveTimers.mockResolvedValue(mockTimers);

      const result = await timerManager.getNextExpiration();

      expect(result).toEqual({
        machineId: 2,
        remainingTimeMs: 30000
      });
    });

    it('should return null when no active timers', async () => {
      mockMachineService.getMachinesWithActiveTimers.mockResolvedValue([]);

      const result = await timerManager.getNextExpiration();

      expect(result).toBeNull();
    });

    it('should handle timers without remaining time', async () => {
      const mockTimers: MachineStatus[] = [
        { id: 1, name: 'Washer 1', status: 'in-use' },
        { id: 2, name: 'Dryer 1', status: 'in-use', remainingTimeMs: 30000 }
      ];
      mockMachineService.getMachinesWithActiveTimers.mockResolvedValue(mockTimers);

      const result = await timerManager.getNextExpiration();

      expect(result).toEqual({
        machineId: 1,
        remainingTimeMs: 0
      });
    });
  });

  describe('cleanup', () => {
    it('should stop the timer manager during cleanup', () => {
      mockMachineService.processExpiredTimers.mockResolvedValue(0);
      
      timerManager.start(1000);
      expect(timerManager.isActive()).toBe(true);

      timerManager.cleanup();
      expect(timerManager.isActive()).toBe(false);
    });
  });


});