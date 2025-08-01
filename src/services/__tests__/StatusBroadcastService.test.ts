import { StatusBroadcastService } from '../StatusBroadcastService';
import { StatusUpdateEvent, MachineStatus } from '../../types';

// Mock Express Response
class MockResponse {
  private headers: Record<string, string> = {};
  private data: string = '';
  private ended: boolean = false;
  private listeners: Record<string, Function[]> = {};

  writeHead(statusCode: number, headers: Record<string, string>) {
    this.headers = { ...headers };
  }

  write(data: string) {
    if (this.ended) {
      throw new Error('Cannot write after end');
    }
    this.data += data;
  }

  end() {
    this.ended = true;
    this.emit('close');
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(...args));
    }
  }

  getData(): string {
    return this.data;
  }

  getHeaders(): Record<string, string> {
    return this.headers;
  }

  isEnded(): boolean {
    return this.ended;
  }
}

describe('StatusBroadcastService', () => {
  let service: StatusBroadcastService;
  let mockResponse: MockResponse;

  beforeEach(() => {
    service = new StatusBroadcastService(false); // Disable ping interval for tests
    mockResponse = new MockResponse();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('Client Management', () => {
    it('should add a client and set up SSE headers', () => {
      const clientId = 'test-client-1';
      
      service.addClient(clientId, mockResponse as any);
      
      expect(service.getClientCount()).toBe(1);
      expect(service.getClientIds()).toContain(clientId);
      
      const headers = mockResponse.getHeaders();
      expect(headers['Content-Type']).toBe('text/event-stream');
      expect(headers['Cache-Control']).toBe('no-cache');
      expect(headers['Connection']).toBe('keep-alive');
    });

    it('should send initial connection event when client is added', () => {
      const clientId = 'test-client-1';
      
      service.addClient(clientId, mockResponse as any);
      
      const data = mockResponse.getData();
      expect(data).toContain('connection');
      expect(data).toContain(clientId);
    });

    it('should remove client when response closes', () => {
      const clientId = 'test-client-1';
      
      service.addClient(clientId, mockResponse as any);
      expect(service.getClientCount()).toBe(1);
      
      mockResponse.emit('close');
      expect(service.getClientCount()).toBe(0);
    });

    it('should handle multiple clients', () => {
      const mockResponse2 = new MockResponse();
      
      service.addClient('client-1', mockResponse as any);
      service.addClient('client-2', mockResponse2 as any);
      
      expect(service.getClientCount()).toBe(2);
      expect(service.getClientIds()).toEqual(['client-1', 'client-2']);
    });

    it('should remove specific client', () => {
      const mockResponse2 = new MockResponse();
      
      service.addClient('client-1', mockResponse as any);
      service.addClient('client-2', mockResponse2 as any);
      
      service.removeClient('client-1');
      
      expect(service.getClientCount()).toBe(1);
      expect(service.getClientIds()).toEqual(['client-2']);
    });
  });

  describe('Status Broadcasting', () => {
    const mockMachine: MachineStatus = {
      id: 1,
      name: 'Washer 1',
      status: 'available',
      remainingTimeMs: 0
    };

    beforeEach(() => {
      service.addClient('test-client', mockResponse as any);
      // Clear initial connection data
      mockResponse = new MockResponse();
      service.removeClient('test-client');
      service.addClient('test-client', mockResponse as any);
    });

    it('should broadcast timer expired event', () => {
      service.broadcastTimerExpired(1, mockMachine);
      
      const data = mockResponse.getData();
      expect(data).toContain('timer_expired');
      expect(data).toContain('"machineId":1');
      expect(data).toContain('Washer 1');
    });

    it('should broadcast timer set event', () => {
      const inUseMachine: MachineStatus = {
        ...mockMachine,
        status: 'in-use',
        remainingTimeMs: 1800000 // 30 minutes
      };
      
      service.broadcastTimerSet(1, inUseMachine);
      
      const data = mockResponse.getData();
      expect(data).toContain('timer_set');
      expect(data).toContain('"machineId":1');
      expect(data).toContain('in-use');
    });

    it('should broadcast machine status update', () => {
      service.broadcastMachineStatusUpdate(1, mockMachine);
      
      const data = mockResponse.getData();
      expect(data).toContain('machine_status_update');
      expect(data).toContain('"machineId":1');
    });

    it('should broadcast to multiple clients', () => {
      const mockResponse2 = new MockResponse();
      service.addClient('client-2', mockResponse2 as any);
      
      service.broadcastTimerExpired(1, mockMachine);
      
      expect(mockResponse.getData()).toContain('timer_expired');
      expect(mockResponse2.getData()).toContain('timer_expired');
    });

    it('should include timestamp in broadcast events', () => {
      const beforeTime = Date.now() - 10; // Add small buffer for timing
      service.broadcastTimerExpired(1, mockMachine);
      const afterTime = Date.now() + 10; // Add small buffer for timing
      
      const data = mockResponse.getData();
      const eventData = JSON.parse(data.split('data: ')[1].split('\n')[0]);
      
      expect(eventData.data.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(eventData.data.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Service Statistics', () => {
    it('should return correct statistics', () => {
      const mockResponse2 = new MockResponse();
      
      service.addClient('client-1', mockResponse as any);
      service.addClient('client-2', mockResponse2 as any);
      
      const stats = service.getStats();
      
      expect(stats.connectedClients).toBe(2);
      expect(stats.clientIds).toEqual(['client-1', 'client-2']);
      expect(stats.pingIntervalActive).toBe(false); // Disabled for tests
    });

    it('should return empty statistics when no clients', () => {
      const stats = service.getStats();
      
      expect(stats.connectedClients).toBe(0);
      expect(stats.clientIds).toEqual([]);
      expect(stats.pingIntervalActive).toBe(false); // Disabled for tests
    });
  });

  describe('Cleanup', () => {
    it('should close all client connections on cleanup', () => {
      const mockResponse2 = new MockResponse();
      
      service.addClient('client-1', mockResponse as any);
      service.addClient('client-2', mockResponse2 as any);
      
      expect(service.getClientCount()).toBe(2);
      
      service.cleanup();
      
      expect(service.getClientCount()).toBe(0);
      expect(mockResponse.isEnded()).toBe(true);
      expect(mockResponse2.isEnded()).toBe(true);
    });

    it('should stop ping interval on cleanup', () => {
      // Create a service with ping enabled to test cleanup
      const serviceWithPing = new StatusBroadcastService(true);
      const stats = serviceWithPing.getStats();
      expect(stats.pingIntervalActive).toBe(true);
      
      serviceWithPing.cleanup();
      
      const statsAfterCleanup = serviceWithPing.getStats();
      expect(statsAfterCleanup.pingIntervalActive).toBe(false);
    });
  });

  describe('Error Handling', () => {
    const mockMachine: MachineStatus = {
      id: 1,
      name: 'Washer 1',
      status: 'available',
      remainingTimeMs: 0
    };

    it('should handle client write errors gracefully', () => {
      // Create a mock response that works for initial connection but fails on broadcast
      let writeCallCount = 0;
      const errorResponse = {
        writeHead: jest.fn(),
        write: jest.fn().mockImplementation(() => {
          writeCallCount++;
          if (writeCallCount > 1) { // Allow initial connection, fail on broadcast
            throw new Error('Write failed');
          }
        }),
        end: jest.fn(),
        on: jest.fn()
      };
      
      service.addClient('error-client', errorResponse as any);
      expect(service.getClientCount()).toBe(1);
      
      // This should not throw even when write fails
      expect(() => {
        service.broadcastTimerExpired(1, mockMachine);
      }).not.toThrow();
      
      // Client should be removed after error
      expect(service.getClientCount()).toBe(0);
    });

    it('should handle response end errors during cleanup', () => {
      const errorResponse = {
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn().mockImplementation(() => {
          throw new Error('End failed');
        }),
        on: jest.fn()
      };
      
      service.addClient('error-client', errorResponse as any);
      
      // Cleanup should not throw even if end() fails
      expect(() => {
        service.cleanup();
      }).not.toThrow();
    });
  });
});