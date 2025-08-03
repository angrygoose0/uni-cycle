/**
 * Unit tests for TimerService
 * Tests timer expiration logic with mocked Date and setTimeout
 */

import { TimerService, TimerEvent } from '../TimerService';
import { LocalStorageService, MachineData } from '../LocalStorageService';
import { MachineService } from '../MachineService';
import { MachineStatus } from '../types';

// Mock the global Date and setInterval/clearInterval
const mockDate = {
  now: jest.fn()
};

const mockSetInterval = jest.fn();
const mockClearInterval = jest.fn();

// Store original implementations
const originalDate = global.Date;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

// Mock window object for browser APIs
const mockWindow = {
  setInterval: mockSetInterval,
  clearInterval: mockClearInterval
};

describe('TimerService', () => {
  let timerService: TimerService;
  let mockStorageService: jest.Mocked<LocalStorageService>;
  let mockMachineService: jest.Mocked<MachineService>;
  let mockMachines: MachineData[];

  beforeEach(() => {
    // Mock Date.now
    global.Date = {
      ...originalDate,
      now: mockDate.now
    } as any;

    // Mock window object
    (global as any).window = mockWindow;

    // Mock setInterval and clearInterval
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;

    // Reset mocks
    jest.clearAllMocks();
    mockDate.now.mockReturnValue(1000000); // Fixed timestamp for testing

    // Create mock services
    mockStorageService = {
      getMachines: jest.fn(),
      saveMachines: jest.fn(),
      getMachineById: jest.fn(),
      updateMachine: jest.fn(),
      addMachine: jest.fn(),
      deleteMachine: jest.fn(),
      getTheme: jest.fn(),
      saveTheme: jest.fn(),
      clearAllData: jest.fn(),
      resetToDefaults: jest.fn(),
      getStorageInfo: jest.fn(),
      isLocalStorageAvailable: jest.fn()
    } as any;

    mockMachineService = {
      getAllMachines: jest.fn(),
      getMachineById: jest.fn(),
      setTimer: jest.fn(),
      clearTimer: jest.fn(),
      getAvailableMachines: jest.fn(),
      getMachinesWithActiveTimers: jest.fn(),
      isMachineAvailable: jest.fn(),
      getMachineStats: jest.fn(),
      initializeDefaultMachines: jest.fn()
    } as any;

    // Setup default mock machines
    mockMachines = [
      {
        id: 1,
        name: 'Washer 1',
        createdAt: 900000,
        updatedAt: 950000
      },
      {
        id: 2,
        name: 'Washer 2',
        timerEndTime: Math.floor(1000000 / 1000) + 1800, // 30 minutes from now
        createdAt: 900000,
        updatedAt: 950000
      },
      {
        id: 3,
        name: 'Dryer 1',
        timerEndTime: Math.floor(1000000 / 1000) - 300, // 5 minutes ago (expired)
        createdAt: 900000,
        updatedAt: 950000
      }
    ];

    mockStorageService.getMachines.mockReturnValue(mockMachines);

    // Create TimerService instance with mocked timer functions
    timerService = new TimerService(
      mockStorageService, 
      mockMachineService,
      mockSetInterval as any,
      mockClearInterval as any
    );
  });

  afterEach(() => {
    // Restore original implementations
    global.Date = originalDate;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    delete (global as any).window;

    // Clean up timer service
    timerService.destroy();
  });

  describe('Timer Monitoring', () => {
    it('should start timer monitoring with setInterval', () => {
      mockSetInterval.mockReturnValue(12345);

      timerService.startTimerMonitoring();

      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
      expect(timerService.isMonitoringActive()).toBe(true);
    });

    it('should not start monitoring if already running', () => {
      mockSetInterval.mockReturnValue(12345);
      
      timerService.startTimerMonitoring();
      timerService.startTimerMonitoring(); // Second call

      expect(mockSetInterval).toHaveBeenCalledTimes(1);
    });

    it('should stop timer monitoring', () => {
      mockSetInterval.mockReturnValue(12345);
      
      timerService.startTimerMonitoring();
      timerService.stopTimerMonitoring();

      expect(mockClearInterval).toHaveBeenCalledWith(12345);
      expect(timerService.isMonitoringActive()).toBe(false);
    });

    it('should handle stop when not running', () => {
      timerService.stopTimerMonitoring();

      expect(mockClearInterval).not.toHaveBeenCalled();
      expect(timerService.isMonitoringActive()).toBe(false);
    });

    it('should check expired timers immediately on start', () => {
      const checkSpy = jest.spyOn(timerService, 'checkExpiredTimers');
      
      timerService.startTimerMonitoring();

      expect(checkSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timer Expiration Logic', () => {
    it('should identify and expire expired timers', () => {
      timerService.checkExpiredTimers();

      // Should save updated machines with expired timer removed
      expect(mockStorageService.saveMachines).toHaveBeenCalledWith([
        mockMachines[0], // No timer, unchanged
        mockMachines[1], // Active timer, unchanged
        {
          ...mockMachines[2],
          timerEndTime: undefined, // Expired timer removed
          updatedAt: 1000000 // Updated timestamp
        }
      ]);
    });

    it('should not update storage if no timers expired', () => {
      // All machines have active or no timers
      const activeMachines = [
        mockMachines[0], // No timer
        mockMachines[1]  // Active timer
      ];
      mockStorageService.getMachines.mockReturnValue(activeMachines);

      timerService.checkExpiredTimers();

      expect(mockStorageService.saveMachines).not.toHaveBeenCalled();
    });

    it('should handle multiple expired timers', () => {
      const machinesWithMultipleExpired = [
        {
          id: 1,
          name: 'Machine 1',
          timerEndTime: Math.floor(1000000 / 1000) - 100, // Expired
          createdAt: 900000,
          updatedAt: 950000
        },
        {
          id: 2,
          name: 'Machine 2',
          timerEndTime: Math.floor(1000000 / 1000) - 200, // Expired
          createdAt: 900000,
          updatedAt: 950000
        }
      ];
      mockStorageService.getMachines.mockReturnValue(machinesWithMultipleExpired);

      timerService.checkExpiredTimers();

      expect(mockStorageService.saveMachines).toHaveBeenCalledWith([
        {
          ...machinesWithMultipleExpired[0],
          timerEndTime: undefined,
          updatedAt: 1000000
        },
        {
          ...machinesWithMultipleExpired[1],
          timerEndTime: undefined,
          updatedAt: 1000000
        }
      ]);
    });

    it('should handle storage errors gracefully', () => {
      mockStorageService.getMachines.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => timerService.checkExpiredTimers()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Error checking expired timers:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Event System', () => {
    it('should emit timer expired events', () => {
      const eventListener = jest.fn();
      timerService.addEventListener('timer_expired', eventListener);

      timerService.checkExpiredTimers();

      expect(eventListener).toHaveBeenCalledWith({
        type: 'timer_expired',
        machineId: 3,
        machine: {
          id: 3,
          name: 'Dryer 1',
          status: 'available',
          remainingTimeMs: undefined
        },
        timestamp: 1000000
      });
    });

    it('should emit timer set events', () => {
      const eventListener = jest.fn();
      const machine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'in-use',
        remainingTimeMs: 1800000
      };

      timerService.addEventListener('timer_set', eventListener);
      timerService.emitTimerSetEvent(1, machine);

      expect(eventListener).toHaveBeenCalledWith({
        type: 'timer_set',
        machineId: 1,
        machine,
        timestamp: 1000000
      });
    });

    it('should emit timer cleared events', () => {
      const eventListener = jest.fn();
      const machine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'available'
      };

      timerService.addEventListener('timer_cleared', eventListener);
      timerService.emitTimerClearedEvent(1, machine);

      expect(eventListener).toHaveBeenCalledWith({
        type: 'timer_cleared',
        machineId: 1,
        machine,
        timestamp: 1000000
      });
    });

    it('should handle multiple event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      timerService.addEventListener('timer_expired', listener1);
      timerService.addEventListener('timer_expired', listener2);

      timerService.checkExpiredTimers();

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const eventListener = jest.fn();

      timerService.addEventListener('timer_expired', eventListener);
      timerService.removeEventListener('timer_expired', eventListener);

      timerService.checkExpiredTimers();

      expect(eventListener).not.toHaveBeenCalled();
    });

    it('should remove all event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      timerService.addEventListener('timer_expired', listener1);
      timerService.addEventListener('timer_set', listener2);

      timerService.removeAllEventListeners();

      timerService.checkExpiredTimers();
      timerService.emitTimerSetEvent(1, { id: 1, name: 'Test', status: 'available' });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should handle errors in event listeners gracefully', () => {
      const faultyListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      timerService.addEventListener('timer_expired', faultyListener);
      timerService.addEventListener('timer_expired', goodListener);

      timerService.checkExpiredTimers();

      expect(faultyListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in timer event listener for timer_expired:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Active Machines and Timing', () => {
    it('should get active machines from machine service', () => {
      const activeMachines: MachineStatus[] = [
        { id: 2, name: 'Washer 2', status: 'in-use', remainingTimeMs: 1800000 }
      ];
      mockMachineService.getMachinesWithActiveTimers.mockReturnValue(activeMachines);

      const result = timerService.getActiveMachines();

      expect(result).toEqual(activeMachines);
      expect(mockMachineService.getMachinesWithActiveTimers).toHaveBeenCalled();
    });

    it('should handle errors when getting active machines', () => {
      mockMachineService.getMachinesWithActiveTimers.mockImplementation(() => {
        throw new Error('Service error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = timerService.getActiveMachines();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting active machines:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should get next expiration time', () => {
      const result = timerService.getNextExpirationTime();

      // Should return the earliest non-expired timer (machine 2)
      expect(result).toBe(Math.floor(1000000 / 1000) + 1800);
    });

    it('should return null if no active timers', () => {
      mockStorageService.getMachines.mockReturnValue([
        { id: 1, name: 'Machine 1', createdAt: 900000, updatedAt: 950000 }
      ]);

      const result = timerService.getNextExpirationTime();

      expect(result).toBeNull();
    });

    it('should get time until next expiration', () => {
      const result = timerService.getTimeUntilNextExpiration();

      // Should return time until machine 2 expires (1800 seconds = 1800000 ms)
      expect(result).toBe(1800000);
    });

    it('should return null if no active timers for time until expiration', () => {
      mockStorageService.getMachines.mockReturnValue([
        { id: 1, name: 'Machine 1', createdAt: 900000, updatedAt: 950000 }
      ]);

      const result = timerService.getTimeUntilNextExpiration();

      expect(result).toBeNull();
    });

    it('should handle errors when getting timing information', () => {
      mockStorageService.getMachines.mockImplementation(() => {
        throw new Error('Storage error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const nextExpiration = timerService.getNextExpirationTime();
      const timeUntilNext = timerService.getTimeUntilNextExpiration();

      expect(nextExpiration).toBeNull();
      expect(timeUntilNext).toBeNull();
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('Service Status and Utilities', () => {
    it('should provide service status', () => {
      mockSetInterval.mockReturnValue(12345);
      mockMachineService.getMachinesWithActiveTimers.mockReturnValue([
        { id: 2, name: 'Washer 2', status: 'in-use', remainingTimeMs: 1800000 }
      ]);

      timerService.startTimerMonitoring();
      timerService.addEventListener('timer_expired', jest.fn());

      const status = timerService.getServiceStatus();

      expect(status).toEqual({
        isRunning: true,
        intervalId: 12345,
        activeMachineCount: 1,
        nextExpirationTime: Math.floor(1000000 / 1000) + 1800,
        timeUntilNextExpiration: 1800000,
        eventListenerCount: 1
      });
    });

    it('should force check expired timers', () => {
      const checkSpy = jest.spyOn(timerService, 'checkExpiredTimers');

      timerService.forceCheckExpiredTimers();

      expect(checkSpy).toHaveBeenCalled();
    });

    it('should destroy service properly', () => {
      mockSetInterval.mockReturnValue(12345);
      mockMachineService.getMachinesWithActiveTimers.mockReturnValue([]);
      
      timerService.startTimerMonitoring();
      timerService.addEventListener('timer_expired', jest.fn());

      timerService.destroy();

      expect(mockClearInterval).toHaveBeenCalledWith(12345);
      expect(timerService.isMonitoringActive()).toBe(false);
      expect(timerService.getServiceStatus().eventListenerCount).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle machines with exactly current time as expiration', () => {
      const machinesWithCurrentTime = [
        {
          id: 1,
          name: 'Machine 1',
          timerEndTime: Math.floor(1000000 / 1000), // Exactly current time
          createdAt: 900000,
          updatedAt: 950000
        }
      ];
      mockStorageService.getMachines.mockReturnValue(machinesWithCurrentTime);

      timerService.checkExpiredTimers();

      expect(mockStorageService.saveMachines).toHaveBeenCalledWith([
        {
          ...machinesWithCurrentTime[0],
          timerEndTime: undefined,
          updatedAt: 1000000
        }
      ]);
    });

    it('should handle empty machines array', () => {
      mockStorageService.getMachines.mockReturnValue([]);

      expect(() => timerService.checkExpiredTimers()).not.toThrow();
      expect(mockStorageService.saveMachines).not.toHaveBeenCalled();
    });

    it('should handle machines with invalid timer data', () => {
      const machinesWithInvalidData = [
        {
          id: 1,
          name: 'Machine 1',
          timerEndTime: null as any, // Invalid timer data
          createdAt: 900000,
          updatedAt: 950000
        }
      ];
      mockStorageService.getMachines.mockReturnValue(machinesWithInvalidData);

      expect(() => timerService.checkExpiredTimers()).not.toThrow();
      expect(mockStorageService.saveMachines).not.toHaveBeenCalled();
    });
  });
});