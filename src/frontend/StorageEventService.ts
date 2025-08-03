/**
 * StorageEventService - Cross-tab synchronization using storage events
 * Handles communication between multiple browser tabs using localStorage events
 * Implements requirements 6.1, 6.2, 6.3, 6.4 for cross-tab synchronization
 */

import { LocalStorageService, MachineData } from './LocalStorageService';
import { MachineStatus } from './types';

export interface StorageSyncEvent {
  type: 'timer_set' | 'timer_expired' | 'machine_updated' | 'machines_reset';
  machineId?: number;
  machine?: MachineStatus;
  timestamp: number;
  tabId: string; // Unique identifier for the tab that triggered the event
}

export interface CrossTabEventListener {
  (event: StorageSyncEvent): void;
}

/**
 * StorageEventService class for cross-tab communication
 */
export class StorageEventService {
  private static readonly SYNC_EVENT_KEY = 'laundry-sync-event';
  private static readonly TAB_ID_KEY = 'laundry-tab-id';
  private static readonly EVENT_CLEANUP_INTERVAL = 60000; // 1 minute
  private static readonly MAX_EVENT_AGE = 300000; // 5 minutes
  
  private storageService: LocalStorageService;
  private tabId: string;
  private eventListeners: Map<string, CrossTabEventListener[]> = new Map();
  private isListening = false;
  private cleanupIntervalId: number | null = null;
  private lastProcessedEventTime = 0;
  
  // Allow dependency injection for testing
  private setIntervalFn: (callback: () => void, ms: number) => number;
  private clearIntervalFn: (id: number) => void;

  constructor(
    storageService?: LocalStorageService,
    setIntervalFn?: (callback: () => void, ms: number) => number,
    clearIntervalFn?: (id: number) => void
  ) {
    this.storageService = storageService || new LocalStorageService();
    this.tabId = this.generateTabId();
    this.setIntervalFn = setIntervalFn || ((callback, ms) => window.setInterval(callback, ms));
    this.clearIntervalFn = clearIntervalFn || ((id) => window.clearInterval(id));
    
    // Store tab ID for debugging
    try {
      sessionStorage.setItem(StorageEventService.TAB_ID_KEY, this.tabId);
    } catch (error) {
      console.warn('Could not store tab ID in sessionStorage:', error);
    }
  }

  /**
   * Start listening for storage events from other tabs
   * Implements requirement 6.1 - synchronize timer updates across all tabs
   */
  public startListening(): void {
    if (this.isListening) {
      console.warn('StorageEventService is already listening');
      return;
    }

    this.isListening = true;
    this.lastProcessedEventTime = Date.now();

    // Listen for storage events (fired when localStorage is modified in other tabs)
    window.addEventListener('storage', this.handleStorageEvent.bind(this));

    // Start cleanup interval to remove old events
    this.cleanupIntervalId = this.setIntervalFn(() => {
      this.cleanupOldEvents();
    }, StorageEventService.EVENT_CLEANUP_INTERVAL);

    console.log(`StorageEventService started listening (Tab ID: ${this.tabId})`);
  }

  /**
   * Stop listening for storage events
   */
  public stopListening(): void {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    window.removeEventListener('storage', this.handleStorageEvent.bind(this));

    if (this.cleanupIntervalId !== null) {
      this.clearIntervalFn(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    console.log('StorageEventService stopped listening');
  }

  /**
   * Broadcast timer set event to other tabs
   * Implements requirement 6.2 - other tabs shall immediately reflect the change
   */
  public broadcastTimerSet(machineId: number, machine: MachineStatus): void {
    const event: StorageSyncEvent = {
      type: 'timer_set',
      machineId,
      machine,
      timestamp: Date.now(),
      tabId: this.tabId
    };

    this.broadcastEvent(event);
  }

  /**
   * Broadcast timer expired event to other tabs
   * Implements requirement 6.3 - all open tabs shall update to show machine as available
   */
  public broadcastTimerExpired(machineId: number, machine: MachineStatus): void {
    const event: StorageSyncEvent = {
      type: 'timer_expired',
      machineId,
      machine,
      timestamp: Date.now(),
      tabId: this.tabId
    };

    this.broadcastEvent(event);
  }

  /**
   * Broadcast machine updated event to other tabs
   */
  public broadcastMachineUpdated(machineId: number, machine: MachineStatus): void {
    const event: StorageSyncEvent = {
      type: 'machine_updated',
      machineId,
      machine,
      timestamp: Date.now(),
      tabId: this.tabId
    };

    this.broadcastEvent(event);
  }

  /**
   * Broadcast machines reset event to other tabs
   */
  public broadcastMachinesReset(): void {
    const event: StorageSyncEvent = {
      type: 'machines_reset',
      timestamp: Date.now(),
      tabId: this.tabId
    };

    this.broadcastEvent(event);
  }

  /**
   * Add event listener for cross-tab events
   */
  public addEventListener(eventType: StorageSyncEvent['type'], listener: CrossTabEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType)!;
    listeners.push(listener);
  }

  /**
   * Remove event listener for cross-tab events
   */
  public removeEventListener(eventType: StorageSyncEvent['type'], listener: CrossTabEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (!listeners) {
      return;
    }

    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Remove all event listeners
   */
  public removeAllEventListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * Get current tab ID
   */
  public getTabId(): string {
    return this.tabId;
  }

  /**
   * Check if service is currently listening
   */
  public isListeningActive(): boolean {
    return this.isListening;
  }

  /**
   * Get service status for debugging
   */
  public getServiceStatus(): {
    isListening: boolean;
    tabId: string;
    eventListenerCount: number;
    lastProcessedEventTime: number;
    storageAvailable: boolean;
  } {
    return {
      isListening: this.isListening,
      tabId: this.tabId,
      eventListenerCount: Array.from(this.eventListeners.values()).reduce((total, listeners) => total + listeners.length, 0),
      lastProcessedEventTime: this.lastProcessedEventTime,
      storageAvailable: this.storageService.isLocalStorageAvailable()
    };
  }

  /**
   * Cleanup resources when service is no longer needed
   */
  public destroy(): void {
    this.stopListening();
    this.removeAllEventListeners();
  }

  /**
   * Generate unique tab ID
   */
  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Broadcast event to other tabs using localStorage
   * Implements requirement 6.4 - broadcast changes to all active tabs
   */
  private broadcastEvent(event: StorageSyncEvent): void {
    try {
      // Only broadcast if localStorage is available
      if (!this.storageService.isLocalStorageAvailable()) {
        console.warn('Cannot broadcast event - localStorage not available');
        return;
      }

      // Store event in localStorage to trigger storage event in other tabs
      const eventData = JSON.stringify(event);
      localStorage.setItem(StorageEventService.SYNC_EVENT_KEY, eventData);

      // Immediately remove the event to avoid conflicts
      // The storage event will still fire in other tabs
      setTimeout(() => {
        try {
          localStorage.removeItem(StorageEventService.SYNC_EVENT_KEY);
        } catch (error) {
          console.warn('Could not remove sync event from localStorage:', error);
        }
      }, 100);

      console.log(`Broadcasted ${event.type} event for machine ${event.machineId} from tab ${this.tabId}`);
    } catch (error) {
      console.error('Error broadcasting event:', error);
    }
  }

  /**
   * Handle storage events from other tabs
   * Implements race condition handling and event deduplication
   */
  private handleStorageEvent(storageEvent: StorageEvent): void {
    try {
      // Only process events for our sync key
      if (storageEvent.key !== StorageEventService.SYNC_EVENT_KEY) {
        return;
      }

      // Ignore events with no new value (removal events)
      if (!storageEvent.newValue) {
        return;
      }

      // Parse the event data
      const syncEvent: StorageSyncEvent = JSON.parse(storageEvent.newValue);

      // Ignore events from our own tab to prevent loops
      if (syncEvent.tabId === this.tabId) {
        return;
      }

      // Handle race conditions - ignore events older than our last processed event
      if (syncEvent.timestamp <= this.lastProcessedEventTime) {
        console.log(`Ignoring old event from ${syncEvent.tabId} (timestamp: ${syncEvent.timestamp})`);
        return;
      }

      // Validate event structure
      if (!this.isValidSyncEvent(syncEvent)) {
        console.warn('Received invalid sync event:', syncEvent);
        return;
      }

      // Update last processed event time
      this.lastProcessedEventTime = syncEvent.timestamp;

      // Emit event to registered listeners
      this.emitEvent(syncEvent);

      console.log(`Processed ${syncEvent.type} event from tab ${syncEvent.tabId} for machine ${syncEvent.machineId}`);
    } catch (error) {
      console.error('Error handling storage event:', error);
    }
  }

  /**
   * Validate sync event structure
   */
  private isValidSyncEvent(event: any): event is StorageSyncEvent {
    if (typeof event !== 'object' || event === null) {
      return false;
    }

    if (typeof event.type !== 'string' || !['timer_set', 'timer_expired', 'machine_updated', 'machines_reset'].includes(event.type)) {
      return false;
    }

    if (typeof event.timestamp !== 'number' || event.timestamp <= 0) {
      return false;
    }

    if (typeof event.tabId !== 'string' || event.tabId.length === 0) {
      return false;
    }

    // For events with machine data, validate the structure
    if (event.type !== 'machines_reset') {
      if (typeof event.machineId !== 'number' || event.machineId <= 0) {
        return false;
      }

      if (event.machine) {
        if (typeof event.machine !== 'object' || 
            typeof event.machine.id !== 'number' ||
            typeof event.machine.name !== 'string' ||
            !['available', 'in-use'].includes(event.machine.status)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Emit event to all registered listeners
   */
  private emitEvent(event: StorageSyncEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (!listeners || listeners.length === 0) {
      return;
    }

    // Call all listeners for this event type
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in cross-tab event listener for ${event.type}:`, error);
      }
    });
  }

  /**
   * Clean up old events to prevent memory leaks
   */
  private cleanupOldEvents(): void {
    try {
      const now = Date.now();
      const cutoffTime = now - StorageEventService.MAX_EVENT_AGE;

      // Update last processed event time to prevent processing very old events
      if (this.lastProcessedEventTime < cutoffTime) {
        this.lastProcessedEventTime = cutoffTime;
      }

      console.log('Cleaned up old cross-tab sync events');
    } catch (error) {
      console.error('Error cleaning up old events:', error);
    }
  }
}