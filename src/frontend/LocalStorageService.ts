/**
 * LocalStorageService - Frontend-only data storage service
 * Handles CRUD operations for machine data using browser localStorage
 * with fallback to sessionStorage and error handling
 */

export interface MachineData {
  id: number;
  name: string;
  timerEndTime?: number; // Unix timestamp when timer expires
  createdAt: number;
  updatedAt: number;
}

export interface LocalStorageSchema {
  'laundry-machines': MachineData[];
  'laundry-timer-theme': 'light' | 'dark';
}

export interface StorageEvent {
  type: 'timer_set' | 'timer_expired' | 'machine_updated';
  machineId: number;
  timestamp: number;
}

export class LocalStorageService {
  private static readonly MACHINES_KEY = 'laundry-machines';
  private static readonly THEME_KEY = 'laundry-timer-theme';
  
  // Default machines data
  private static readonly DEFAULT_MACHINES: MachineData[] = [
    { id: 1, name: 'Washer 1', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 2, name: 'Washer 2', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 3, name: 'Dryer 1', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 4, name: 'Dryer 2', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 5, name: 'Dryer 3', createdAt: Date.now(), updatedAt: Date.now() }
  ];

  private storage: Storage;
  private fallbackStorage: Map<string, string> = new Map();

  constructor() {
    this.storage = this.getAvailableStorage();
  }

  /**
   * Get available storage (localStorage, sessionStorage, or in-memory fallback)
   */
  private getAvailableStorage(): Storage {
    try {
      if (this.isStorageAvailable(window.localStorage)) {
        return window.localStorage;
      }
      if (this.isStorageAvailable(window.sessionStorage)) {
        console.warn('localStorage not available, falling back to sessionStorage');
        return window.sessionStorage;
      }
    } catch (error) {
      console.warn('Browser storage not available, using in-memory fallback');
    }
    
    // Return in-memory fallback that implements Storage interface
    return this.createInMemoryStorage();
  }

  /**
   * Check if storage is available and working
   */
  private isStorageAvailable(storage: Storage): boolean {
    try {
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create in-memory storage fallback
   */
  private createInMemoryStorage(): Storage {
    const storage = this.fallbackStorage;
    
    return {
      length: storage.size,
      key: (index: number): string | null => {
        const keys = Array.from(storage.keys());
        return keys[index] || null;
      },
      getItem: (key: string): string | null => {
        return storage.get(key) || null;
      },
      setItem: (key: string, value: string): void => {
        storage.set(key, value);
      },
      removeItem: (key: string): void => {
        storage.delete(key);
      },
      clear: (): void => {
        storage.clear();
      }
    };
  }

  /**
   * Check if localStorage is available (not sessionStorage or in-memory)
   */
  public isLocalStorageAvailable(): boolean {
    return this.storage === window.localStorage;
  }

  /**
   * Get all machines from storage
   */
  public getMachines(): MachineData[] {
    try {
      const data = this.storage.getItem(LocalStorageService.MACHINES_KEY);
      if (!data) {
        // Initialize with default machines if no data exists
        this.saveMachines(LocalStorageService.DEFAULT_MACHINES);
        return [...LocalStorageService.DEFAULT_MACHINES];
      }

      const machines = JSON.parse(data) as MachineData[];
      this.validateMachinesData(machines);
      return machines;
    } catch (error) {
      console.error('Error reading machines from storage:', error);
      // Return default machines on error
      return [...LocalStorageService.DEFAULT_MACHINES];
    }
  }

  /**
   * Save machines to storage
   */
  public saveMachines(machines: MachineData[]): void {
    try {
      this.validateMachinesData(machines);
      const data = JSON.stringify(machines);
      this.storage.setItem(LocalStorageService.MACHINES_KEY, data);
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        this.handleQuotaExceeded();
        throw new Error('Storage quota exceeded. Please clear some data or use a different browser.');
      }
      // Re-throw validation errors with original message
      if (error instanceof Error && error.message.includes('must be')) {
        throw error;
      }
      console.error('Error saving machines to storage:', error);
      throw new Error('Failed to save machine data');
    }
  }

  /**
   * Get a specific machine by ID
   */
  public getMachineById(id: number): MachineData | null {
    const machines = this.getMachines();
    return machines.find(machine => machine.id === id) || null;
  }

  /**
   * Update a specific machine
   */
  public updateMachine(updatedMachine: MachineData): void {
    const machines = this.getMachines();
    const index = machines.findIndex(machine => machine.id === updatedMachine.id);
    
    if (index === -1) {
      throw new Error(`Machine with ID ${updatedMachine.id} not found`);
    }

    machines[index] = { ...updatedMachine, updatedAt: Date.now() };
    this.saveMachines(machines);
  }

  /**
   * Add a new machine
   */
  public addMachine(machine: Omit<MachineData, 'id' | 'createdAt' | 'updatedAt'>): MachineData {
    const machines = this.getMachines();
    const maxId = machines.reduce((max, m) => Math.max(max, m.id), 0);
    
    const newMachine: MachineData = {
      ...machine,
      id: maxId + 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    machines.push(newMachine);
    this.saveMachines(machines);
    return newMachine;
  }

  /**
   * Delete a machine by ID
   */
  public deleteMachine(id: number): boolean {
    const machines = this.getMachines();
    const initialLength = machines.length;
    const filteredMachines = machines.filter(machine => machine.id !== id);
    
    if (filteredMachines.length === initialLength) {
      return false; // Machine not found
    }

    this.saveMachines(filteredMachines);
    return true;
  }

  /**
   * Get theme preference
   */
  public getTheme(): 'light' | 'dark' {
    try {
      const theme = this.storage.getItem(LocalStorageService.THEME_KEY);
      return (theme === 'dark' || theme === 'light') ? theme : 'light';
    } catch (error) {
      console.error('Error reading theme from storage:', error);
      return 'light';
    }
  }

  /**
   * Save theme preference
   */
  public saveTheme(theme: 'light' | 'dark'): void {
    try {
      this.storage.setItem(LocalStorageService.THEME_KEY, theme);
    } catch (error) {
      console.error('Error saving theme to storage:', error);
    }
  }

  /**
   * Clear all data from storage
   */
  public clearAllData(): void {
    try {
      this.storage.removeItem(LocalStorageService.MACHINES_KEY);
      this.storage.removeItem(LocalStorageService.THEME_KEY);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Reset to default machines
   */
  public resetToDefaults(): void {
    this.saveMachines(LocalStorageService.DEFAULT_MACHINES);
  }

  /**
   * Get storage info for debugging
   */
  public getStorageInfo(): {
    type: 'localStorage' | 'sessionStorage' | 'memory';
    available: boolean;
    machineCount: number;
  } {
    let type: 'localStorage' | 'sessionStorage' | 'memory';
    
    if (this.storage === window.localStorage) {
      type = 'localStorage';
    } else if (this.storage === window.sessionStorage) {
      type = 'sessionStorage';
    } else {
      type = 'memory';
    }

    return {
      type,
      available: this.isLocalStorageAvailable(),
      machineCount: this.getMachines().length
    };
  }

  /**
   * Validate machines data structure
   */
  private validateMachinesData(machines: any): asserts machines is MachineData[] {
    if (!Array.isArray(machines)) {
      throw new Error('Machines data must be an array');
    }

    for (const machine of machines) {
      if (typeof machine !== 'object' || machine === null) {
        throw new Error('Each machine must be an object');
      }

      if (typeof machine.id !== 'number' || machine.id <= 0) {
        throw new Error('Machine ID must be a positive number');
      }

      if (typeof machine.name !== 'string' || machine.name.trim().length === 0) {
        throw new Error('Machine name must be a non-empty string');
      }

      if (machine.timerEndTime !== undefined && (typeof machine.timerEndTime !== 'number' || machine.timerEndTime <= 0)) {
        throw new Error('Timer end time must be a positive number or undefined');
      }

      if (typeof machine.createdAt !== 'number' || machine.createdAt <= 0) {
        throw new Error('Created timestamp must be a positive number');
      }

      if (typeof machine.updatedAt !== 'number' || machine.updatedAt <= 0) {
        throw new Error('Updated timestamp must be a positive number');
      }
    }
  }

  /**
   * Check if error is quota exceeded
   */
  private isQuotaExceededError(error: any): boolean {
    return error instanceof DOMException && (
      error.code === 22 || // QUOTA_EXCEEDED_ERR
      error.code === 1014 || // NS_ERROR_DOM_QUOTA_REACHED (Firefox)
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }

  /**
   * Handle quota exceeded by clearing expired timers
   */
  private handleQuotaExceeded(): void {
    try {
      const machines = this.getMachines();
      const now = Math.floor(Date.now() / 1000);
      
      // Clear expired timers to free up space
      const cleanedMachines = machines.map(machine => {
        if (machine.timerEndTime && machine.timerEndTime <= now) {
          return { ...machine, timerEndTime: undefined, updatedAt: Date.now() };
        }
        return machine;
      });

      // Try to save cleaned data
      const data = JSON.stringify(cleanedMachines);
      this.storage.setItem(LocalStorageService.MACHINES_KEY, data);
      
      console.log('Cleared expired timers to free up storage space');
    } catch (error) {
      console.error('Failed to clean up storage:', error);
    }
  }
}