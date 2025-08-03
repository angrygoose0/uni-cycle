/**
 * StorageEventService Integration Tests
 * Tests cross-tab synchronization scenarios and race condition handling
 */

import { StorageEventService, StorageSyncEvent, CrossTabEventListener } from '../StorageEventService';
import { LocalStorageService, MachineData } from '../LocalStorageService';
import { MachineStatus } from '../types';

// Mock localStorage for testing
class MockStorage implements Storage {
  private data: Map<string, string> = new Map();
  private eventListeners: ((event: StorageEvent) => void)[] = [];

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] || null;
  }

  getItem(key: string): string | null {
    return this.data.get(key) || null;
  }

  setItem(key: string, value: string): void {
    const oldValue = this.data.get(key) || null;
    this.data.set(key, value);
    
    // Simulate storage event for other tabs
    const event = new MockStorageEvent('storage', {
      key,
      oldValue,
      newValue: value,
      url: 'http://localhost',
      storageArea: this
    });
    
    // Trigger event listeners asynchronously to simulate real behavior
    setTimeout(() => {
      this.eventListeners.forEach(listener => listener(event as any));
    }, 0);
  }

  removeItem(key: string): void {
    const oldValue = this.data.get(key) || null;
    this.data.delete(key);
    
    // Simulate storage event for other tabs
    const event = new MockStorageEvent('storage', {
      key,
      oldValue,
      newValue: null,
      url: 'http://localhost',
      storageArea: this
    });
    
    setTimeout(() => {
      this.eventListeners.forEach(listener => listener(event as any));
    }, 0);
  }

  clear(): void {
    this.data.clear();
  }

  // Method to add event listeners for testing
  addEventListener(listener: (event: StorageEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: StorageEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }
}

// Mock StorageEvent for testing
class MockStorageEvent {
  public key: string | null;
  public oldValue: string | null;
  public newValue: string | null;
  public url: string;
  public storageArea: Storage | null;

  constructor(type: string, eventInitDict: {
    key?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    url?: string;
    storageArea?: Storage | null;
  } = {}) {
    this.key = eventInitDict.key || null;
    this.oldValue = eventInitDict.oldValue || null;
    this.newValue = eventInitDict.newValue || null;
    this.url = eventInitDict.url || '';
    this.storageArea = eventInitDict.storageArea || null;
  }
}

// Mock sessionStorage
const mockSessionStorage = {
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

// Mock window object for testing
const mockWindow = {
  localStorage: new MockStorage(),
  sessionStorage: mockSessionStorage,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock global objects
Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

Object.defineProperty(global, 'localStorage', {
  value: mockWindow.localStorage,
  writable: true
});

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
});

Object.defineProperty(global, 'StorageEvent', {
  value: MockStorageEvent,
  writable: true
});

describe('StorageEventService', () => {
  let mockStorage: MockStorage;
  let storageService: LocalStorageService;
  let storageEventService: StorageEventService;
  let mockSetInterval: jest.Mock;
  let mockClearInterval: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create fresh mock storage
    mockStorage = new MockStorage();
    Object.defineProperty(global, 'localStorage', {
      value: mockStorage,
      writable: true
    });
    
    // Mock interval functions
    mockSetInterval = jest.fn().mockReturnValue(123);
    mockClearInterval = jest.fn();
    
    // Create services
    storageService = new LocalStorageService();
    storageEventService = new StorageEventService(
      storageService,
      mockSetInterval,
      mockClearInterval
    );
  });

  afterEach(() => {
    storageEventService.destroy();
  });

  describe('Service Initialization', () => {
    it('should generate unique tab ID', () => {
      const service1 = new StorageEventService();
      const service2 = new StorageEventService();
      
      expect(service1.getTabId()).not.toBe(service2.getTabId());
      expect(service1.getTabId()).toMatch(/^tab_\d+_[a-z0-9]+$/);
      
      service1.destroy();
      service2.destroy();
    });

    it('should initialize with correct default state', () => {
      const status = storageEventService.getServiceStatus();
      
      expect(status.isListening).toBe(false);
      expect(status.eventListenerCount).toBe(0);
      expect(status.storageAvailable).toBe(true);
      expect(status.tabId).toMatch(/^tab_\d+_[a-z0-9]+$/);
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast timer set event', async () => {
      const machine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'in-use',
        remainingTimeMs: 1800000
      };

      storageEventService.broadcastTimerSet(1, machine);

      // Check that event was stored in localStorage
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Event should be removed after broadcasting
      expect(mockStorage.getItem('laundry-sync-event')).toBeNull();
    });

    it('should broadcast timer expired event', async () => {
      const machine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'available'
      };

      storageEventService.broadcastTimerExpired(1, machine);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockStorage.getItem('laundry-sync-event')).toBeNull();
    });

    it('should broadcast machine updated event', async () => {
      const machine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'available'
      };

      storageEventService.broadcastMachineUpdated(1, machine);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockStorage.getItem('laundry-sync-event')).toBeNull();
    });

    it('should broadcast machines reset event', async () => {
      storageEventService.broadcastMachinesReset();

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockStorage.getItem('laundry-sync-event')).toBeNull();
    });
  });

  describe('Cross-Tab Event Listening', () => {
    let receivedEvents: StorageSyncEvent[];
    let eventListener: CrossTabEventListener;

    beforeEach(() => {
      receivedEvents = [];
      eventListener = (event: StorageSyncEvent) => {
        receivedEvents.push(event);
      };
    });

    it('should start and stop listening correctly', () => {
      expect(storageEventService.isListeningActive()).toBe(false);

      storageEventService.startListening();
      expect(storageEventService.isListeningActive()).toBe(true);
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 60000);

      storageEventService.stopListening();
      expect(storageEventService.isListeningActive()).toBe(false);
      expect(mockClearInterval).toHaveBeenCalledWith(123);
    });

    it('should receive timer set events from other tabs', async () => {
      storageEventService.addEventListener('timer_set', eventListener);
      storageEventService.startListening();

      // Simulate event from another tab
      const otherTabEvent: StorageSyncEvent = {
        type: 'timer_set',
        machineId: 1,
        machine: { id: 1, name: 'Washer 1', status: 'in-use', remainingTimeMs: 1800000 },
        timestamp: Date.now(),
        tabId: 'other_tab_123'
      };

      // Simulate storage event from another tab
      const storageEvent = new MockStorageEvent('storage', {
        key: 'laundry-sync-event',
        oldValue: null,
        newValue: JSON.stringify(otherTabEvent),
        url: 'http://localhost',
        storageArea: mockStorage
      });

      // Trigger the storage event handler
      const handler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'storage'
      )?.[1];
      
      if (handler) {
        handler(storageEvent);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toMatchObject({
        type: 'timer_set',
        machineId: 1,
        tabId: 'other_tab_123'
      });
    });

    it('should receive timer expired events from other tabs', async () => {
      storageEventService.addEventListener('timer_expired', eventListener);
      storageEventService.startListening();

      const otherTabEvent: StorageSyncEvent = {
        type: 'timer_expired',
        machineId: 1,
        machine: { id: 1, name: 'Washer 1', status: 'available' },
        timestamp: Date.now(),
        tabId: 'other_tab_456'
      };

      const storageEvent = new MockStorageEvent('storage', {
        key: 'laundry-sync-event',
        oldValue: null,
        newValue: JSON.stringify(otherTabEvent),
        url: 'http://localhost',
        storageArea: mockStorage
      });

      const handler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'storage'
      )?.[1];
      
      if (handler) {
        handler(storageEvent);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toMatchObject({
        type: 'timer_expired',
        machineId: 1,
        tabId: 'other_tab_456'
      });
    });

    it('should ignore events from same tab', async () => {
      storageEventService.addEventListener('timer_set', eventListener);
      storageEventService.startListening();

      const sameTabEvent: StorageSyncEvent = {
        type: 'timer_set',
        machineId: 1,
        machine: { id: 1, name: 'Washer 1', status: 'in-use' },
        timestamp: Date.now(),
        tabId: storageEventService.getTabId() // Same tab ID
      };

      const storageEvent = new MockStorageEvent('storage', {
        key: 'laundry-sync-event',
        oldValue: null,
        newValue: JSON.stringify(sameTabEvent),
        url: 'http://localhost',
        storageArea: mockStorage
      });

      const handler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'storage'
      )?.[1];
      
      if (handler) {
        handler(storageEvent);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents).toHaveLength(0);
    });

    it('should ignore events for wrong storage key', async () => {
      storageEventService.addEventListener('timer_set', eventListener);
      storageEventService.startListening();

      const storageEvent = new StorageEvent('storage', {
        key: 'some-other-key',
        oldValue: null,
        newValue: 'some value',
        url: 'http://localhost',
        storageArea: mockStorage
      });

      const handler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'storage'
      )?.[1];
      
      if (handler) {
        handler(storageEvent);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents).toHaveLength(0);
    });
  });

  describe('Race Condition Handling', () => {
    let receivedEvents: StorageSyncEvent[];
    let eventListener: CrossTabEventListener;

    beforeEach(() => {
      receivedEvents = [];
      eventListener = (event: StorageSyncEvent) => {
        receivedEvents.push(event);
      };
      storageEventService.addEventListener('timer_set', eventListener);
      storageEventService.startListening();
    });

    it('should ignore old events based on timestamp', async () => {
      const now = Date.now();
      
      // Process a newer event first
      const newerEvent: StorageSyncEvent = {
        type: 'timer_set',
        machineId: 1,
        machine: { id: 1, name: 'Washer 1', status: 'in-use' },
        timestamp: now + 1000,
        tabId: 'other_tab_123'
      };

      let storageEvent = new StorageEvent('storage', {
        key: 'laundry-sync-event',
        oldValue: null,
        newValue: JSON.stringify(newerEvent),
        url: 'http://localhost',
        storageArea: mockStorage
      });

      const handler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'storage'
      )?.[1];
      
      if (handler) {
        handler(storageEvent);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Now try to process an older event
      const olderEvent: StorageSyncEvent = {
        type: 'timer_set',
        machineId: 2,
        machine: { id: 2, name: 'Washer 2', status: 'in-use' },
        timestamp: now - 1000, // Older timestamp
        tabId: 'other_tab_456'
      };

      storageEvent = new StorageEvent('storage', {
        key: 'laundry-sync-event',
        oldValue: null,
        newValue: JSON.stringify(olderEvent),
        url: 'http://localhost',
        storageArea: mockStorage
      });

      if (handler) {
        handler(storageEvent);
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should only have received the newer event
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].timestamp).toBe(now + 1000);
    });

    it('should handle invalid event data gracefully', async () => {
      const invalidEvents = [
        'invalid json',
        '{}',
        '{"type": "invalid_type"}',
        '{"type": "timer_set", "timestamp": "not_a_number"}',
        '{"type": "timer_set", "timestamp": 123, "tabId": ""}',
        '{"type": "timer_set", "timestamp": 123, "tabId": "tab1", "machineId": "not_a_number"}'
      ];

      const handler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'storage'
      )?.[1];

      for (const invalidEvent of invalidEvents) {
        const storageEvent = new StorageEvent('storage', {
          key: 'laundry-sync-event',
          oldValue: null,
          newValue: invalidEvent,
          url: 'http://localhost',
          storageArea: mockStorage
        });

        if (handler) {
          handler(storageEvent);
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should not have received any events
      expect(receivedEvents).toHaveLength(0);
    });
  });

  describe('Event Listener Management', () => {
    it('should add and remove event listeners correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(0);

      storageEventService.addEventListener('timer_set', listener1);
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(1);

      storageEventService.addEventListener('timer_set', listener2);
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(2);

      storageEventService.addEventListener('timer_expired', listener1);
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(3);

      storageEventService.removeEventListener('timer_set', listener1);
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(2);

      storageEventService.removeAllEventListeners();
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(0);
    });

    it('should handle removing non-existent listeners gracefully', () => {
      const listener = jest.fn();
      
      // Try to remove listener that was never added
      storageEventService.removeEventListener('timer_set', listener);
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(0);

      // Add listener and remove it twice
      storageEventService.addEventListener('timer_set', listener);
      storageEventService.removeEventListener('timer_set', listener);
      storageEventService.removeEventListener('timer_set', listener);
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(0);
    });
  });

  describe('Service Lifecycle', () => {
    it('should handle multiple start/stop cycles', () => {
      // Start multiple times
      storageEventService.startListening();
      storageEventService.startListening();
      expect(storageEventService.isListeningActive()).toBe(true);
      expect(mockSetInterval).toHaveBeenCalledTimes(1);

      // Stop multiple times
      storageEventService.stopListening();
      storageEventService.stopListening();
      expect(storageEventService.isListeningActive()).toBe(false);
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });

    it('should clean up resources on destroy', () => {
      storageEventService.addEventListener('timer_set', jest.fn());
      storageEventService.startListening();

      expect(storageEventService.isListeningActive()).toBe(true);
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(1);

      storageEventService.destroy();

      expect(storageEventService.isListeningActive()).toBe(false);
      expect(storageEventService.getServiceStatus().eventListenerCount).toBe(0);
    });
  });

  describe('Storage Availability', () => {
    it('should handle localStorage unavailability gracefully', () => {
      // Create service with storage that reports localStorage as unavailable
      const mockStorageService = {
        isLocalStorageAvailable: () => false
      } as LocalStorageService;

      const service = new StorageEventService(mockStorageService);
      
      // Should not throw when broadcasting events
      expect(() => {
        service.broadcastTimerSet(1, { id: 1, name: 'Test', status: 'in-use' });
      }).not.toThrow();

      service.destroy();
    });
  });
});