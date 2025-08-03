/**
 * Unit tests for LocalStorageService
 * Tests CRUD operations, error handling, and storage fallbacks
 * @jest-environment jsdom
 */

import { LocalStorageService, MachineData } from '../LocalStorageService';

// Mock localStorage and sessionStorage
const createMockStorage = (): Storage => {
  let store: { [key: string]: string } = {};
  
  return {
    length: Object.keys(store).length,
    key: (index: number): string | null => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    getItem: (key: string): string | null => {
      return store[key] || null;
    },
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    }
  };
};

// Mock quota exceeded error
const createQuotaExceededError = (): DOMException => {
  const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
  Object.defineProperty(error, 'code', { value: 22 });
  return error;
};

describe('LocalStorageService', () => {
  let mockLocalStorage: Storage;
  let mockSessionStorage: Storage;
  let service: LocalStorageService;

  beforeEach(() => {
    mockLocalStorage = createMockStorage();
    mockSessionStorage = createMockStorage();
    
    // Mock window.localStorage and window.sessionStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });

    service = new LocalStorageService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Storage Detection', () => {
    it('should use localStorage when available', () => {
      const storageInfo = service.getStorageInfo();
      expect(storageInfo.type).toBe('localStorage');
      expect(storageInfo.available).toBe(true);
    });

    it('should fallback to sessionStorage when localStorage is not available', () => {
      // Mock localStorage to throw error
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: () => { throw new Error('localStorage not available'); },
          getItem: () => { throw new Error('localStorage not available'); },
          removeItem: () => { throw new Error('localStorage not available'); },
          clear: () => { throw new Error('localStorage not available'); },
          length: 0,
          key: () => null
        },
        writable: true
      });

      const fallbackService = new LocalStorageService();
      const storageInfo = fallbackService.getStorageInfo();
      expect(storageInfo.type).toBe('sessionStorage');
    });

    it('should fallback to in-memory storage when both localStorage and sessionStorage are not available', () => {
      // Mock both storages to throw errors
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: () => { throw new Error('localStorage not available'); },
          getItem: () => { throw new Error('localStorage not available'); },
          removeItem: () => { throw new Error('localStorage not available'); },
          clear: () => { throw new Error('localStorage not available'); },
          length: 0,
          key: () => null
        },
        writable: true
      });

      Object.defineProperty(window, 'sessionStorage', {
        value: {
          setItem: () => { throw new Error('sessionStorage not available'); },
          getItem: () => { throw new Error('sessionStorage not available'); },
          removeItem: () => { throw new Error('sessionStorage not available'); },
          clear: () => { throw new Error('sessionStorage not available'); },
          length: 0,
          key: () => null
        },
        writable: true
      });

      const fallbackService = new LocalStorageService();
      const storageInfo = fallbackService.getStorageInfo();
      expect(storageInfo.type).toBe('memory');
    });
  });

  describe('getMachines', () => {
    it('should return default machines when no data exists', () => {
      const machines = service.getMachines();
      expect(machines).toHaveLength(5);
      expect(machines[0]).toEqual(expect.objectContaining({
        id: 1,
        name: 'Washer 1'
      }));
    });

    it('should return stored machines when data exists', () => {
      const testMachines: MachineData[] = [
        { id: 1, name: 'Test Machine', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      
      mockLocalStorage.setItem('laundry-machines', JSON.stringify(testMachines));
      
      const machines = service.getMachines();
      expect(machines).toHaveLength(1);
      expect(machines[0].name).toBe('Test Machine');
    });

    it('should return default machines when stored data is corrupted', () => {
      mockLocalStorage.setItem('laundry-machines', 'invalid json');
      
      const machines = service.getMachines();
      expect(machines).toHaveLength(5);
      expect(machines[0].name).toBe('Washer 1');
    });

    it('should return default machines when stored data fails validation', () => {
      const invalidData = [{ id: 'invalid', name: 123 }];
      mockLocalStorage.setItem('laundry-machines', JSON.stringify(invalidData));
      
      const machines = service.getMachines();
      expect(machines).toHaveLength(5);
      expect(machines[0].name).toBe('Washer 1');
    });
  });

  describe('saveMachines', () => {
    it('should save valid machines data', () => {
      const testMachines: MachineData[] = [
        { id: 1, name: 'Test Machine', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      
      service.saveMachines(testMachines);
      
      const stored = mockLocalStorage.getItem('laundry-machines');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(testMachines);
    });

    it('should throw error for invalid machines data', () => {
      const invalidMachines = [
        { id: -1, name: '', createdAt: 0, updatedAt: 0 }
      ] as MachineData[];
      
      expect(() => service.saveMachines(invalidMachines)).toThrow();
    });

    it('should handle quota exceeded error', () => {
      // Mock setItem to throw quota exceeded error
      jest.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => {
        throw createQuotaExceededError();
      });

      const testMachines: MachineData[] = [
        { id: 1, name: 'Test Machine', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      
      expect(() => service.saveMachines(testMachines)).toThrow('Storage quota exceeded');
    });
  });

  describe('getMachineById', () => {
    beforeEach(() => {
      const testMachines: MachineData[] = [
        { id: 1, name: 'Machine 1', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 2, name: 'Machine 2', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      service.saveMachines(testMachines);
    });

    it('should return machine when found', () => {
      const machine = service.getMachineById(1);
      expect(machine).toBeTruthy();
      expect(machine!.name).toBe('Machine 1');
    });

    it('should return null when machine not found', () => {
      const machine = service.getMachineById(999);
      expect(machine).toBeNull();
    });
  });

  describe('updateMachine', () => {
    beforeEach(() => {
      const testMachines: MachineData[] = [
        { id: 1, name: 'Machine 1', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 2, name: 'Machine 2', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      service.saveMachines(testMachines);
    });

    it('should update existing machine', () => {
      const updatedMachine: MachineData = {
        id: 1,
        name: 'Updated Machine',
        timerEndTime: Date.now() + 3600,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      service.updateMachine(updatedMachine);
      
      const machine = service.getMachineById(1);
      expect(machine!.name).toBe('Updated Machine');
      expect(machine!.timerEndTime).toBe(updatedMachine.timerEndTime);
    });

    it('should throw error when machine not found', () => {
      const nonExistentMachine: MachineData = {
        id: 999,
        name: 'Non-existent',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      expect(() => service.updateMachine(nonExistentMachine)).toThrow('Machine with ID 999 not found');
    });
  });

  describe('addMachine', () => {
    it('should add new machine with auto-generated ID', () => {
      const newMachine = service.addMachine({ name: 'New Machine' });
      
      expect(newMachine.id).toBeGreaterThan(0);
      expect(newMachine.name).toBe('New Machine');
      expect(newMachine.createdAt).toBeTruthy();
      expect(newMachine.updatedAt).toBeTruthy();
      
      const machines = service.getMachines();
      expect(machines).toContainEqual(newMachine);
    });

    it('should generate sequential IDs', () => {
      const machine1 = service.addMachine({ name: 'Machine 1' });
      const machine2 = service.addMachine({ name: 'Machine 2' });
      
      expect(machine2.id).toBe(machine1.id + 1);
    });
  });

  describe('deleteMachine', () => {
    beforeEach(() => {
      const testMachines: MachineData[] = [
        { id: 1, name: 'Machine 1', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 2, name: 'Machine 2', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      service.saveMachines(testMachines);
    });

    it('should delete existing machine', () => {
      const result = service.deleteMachine(1);
      expect(result).toBe(true);
      
      const machine = service.getMachineById(1);
      expect(machine).toBeNull();
      
      const machines = service.getMachines();
      expect(machines).toHaveLength(1);
    });

    it('should return false when machine not found', () => {
      const result = service.deleteMachine(999);
      expect(result).toBe(false);
    });
  });

  describe('Theme Management', () => {
    it('should return default theme when none stored', () => {
      const theme = service.getTheme();
      expect(theme).toBe('light');
    });

    it('should save and retrieve theme', () => {
      service.saveTheme('dark');
      const theme = service.getTheme();
      expect(theme).toBe('dark');
    });

    it('should return default theme on storage error', () => {
      jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const theme = service.getTheme();
      expect(theme).toBe('light');
    });
  });

  describe('Data Management', () => {
    it('should clear all data', () => {
      service.saveTheme('dark');
      service.saveMachines([
        { id: 1, name: 'Test', createdAt: Date.now(), updatedAt: Date.now() }
      ]);
      
      service.clearAllData();
      
      expect(mockLocalStorage.getItem('laundry-machines')).toBeNull();
      expect(mockLocalStorage.getItem('laundry-timer-theme')).toBeNull();
    });

    it('should reset to default machines', () => {
      service.saveMachines([
        { id: 1, name: 'Custom Machine', createdAt: Date.now(), updatedAt: Date.now() }
      ]);
      
      service.resetToDefaults();
      
      const machines = service.getMachines();
      expect(machines).toHaveLength(5);
      expect(machines[0].name).toBe('Washer 1');
    });
  });

  describe('Data Validation', () => {
    it('should validate machine ID', () => {
      const invalidMachines = [
        { id: 0, name: 'Test', createdAt: Date.now(), updatedAt: Date.now() }
      ] as MachineData[];
      
      expect(() => service.saveMachines(invalidMachines)).toThrow('Machine ID must be a positive number');
    });

    it('should validate machine name', () => {
      const invalidMachines = [
        { id: 1, name: '', createdAt: Date.now(), updatedAt: Date.now() }
      ] as MachineData[];
      
      expect(() => service.saveMachines(invalidMachines)).toThrow('Machine name must be a non-empty string');
    });

    it('should validate timer end time', () => {
      const invalidMachines = [
        { id: 1, name: 'Test', timerEndTime: -1, createdAt: Date.now(), updatedAt: Date.now() }
      ] as MachineData[];
      
      expect(() => service.saveMachines(invalidMachines)).toThrow('Timer end time must be a positive number or undefined');
    });

    it('should validate timestamps', () => {
      const invalidMachines = [
        { id: 1, name: 'Test', createdAt: 0, updatedAt: Date.now() }
      ] as MachineData[];
      
      expect(() => service.saveMachines(invalidMachines)).toThrow('Created timestamp must be a positive number');
    });
  });

  describe('Error Handling', () => {
    it('should handle quota exceeded by cleaning expired timers', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredTime = now - 3600; // 1 hour ago
      
      const machinesWithExpiredTimer: MachineData[] = [
        { id: 1, name: 'Machine 1', timerEndTime: expiredTime, createdAt: Date.now(), updatedAt: Date.now() },
        { id: 2, name: 'Machine 2', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      
      service.saveMachines(machinesWithExpiredTimer);
      
      // Mock setItem to throw quota exceeded error
      jest.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => {
        throw createQuotaExceededError();
      });
      
      const newMachines: MachineData[] = [
        { id: 3, name: 'New Machine', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      
      expect(() => service.saveMachines(newMachines)).toThrow('Storage quota exceeded');
    });
  });
});