import request from 'supertest';
import { app } from '../../index';
import { MachineController } from '../MachineController';
import { StatusBroadcastService } from '../../services/StatusBroadcastService';
import { MachineService } from '../../services/MachineService';

describe('Real-time Status Updates Integration', () => {
  let statusBroadcastService: StatusBroadcastService;
  let machineService: MachineService;
  let machineController: MachineController;

  beforeEach(() => {
    statusBroadcastService = new StatusBroadcastService(false); // Disable ping for tests
    machineService = new MachineService();
    machineController = new MachineController(machineService, statusBroadcastService);
  });

  afterEach(() => {
    statusBroadcastService.cleanup();
  });

  describe('StatusBroadcastService Integration', () => {
    it('should create StatusBroadcastService with correct methods', () => {
      expect(statusBroadcastService).toBeDefined();
      expect(typeof statusBroadcastService.addClient).toBe('function');
      expect(typeof statusBroadcastService.broadcastTimerSet).toBe('function');
      expect(typeof statusBroadcastService.broadcastTimerExpired).toBe('function');
      expect(typeof statusBroadcastService.getClientCount).toBe('function');
    });

    it('should broadcast timer set events', () => {
      const mockMachine = {
        id: 1,
        name: 'Washer 1',
        status: 'in-use' as const,
        remainingTimeMs: 1800000
      };

      // This should not throw
      expect(() => {
        statusBroadcastService.broadcastTimerSet(1, mockMachine);
      }).not.toThrow();
    });

    it('should broadcast timer expired events', () => {
      const mockMachine = {
        id: 1,
        name: 'Washer 1',
        status: 'available' as const,
        remainingTimeMs: 0
      };

      // This should not throw
      expect(() => {
        statusBroadcastService.broadcastTimerExpired(1, mockMachine);
      }).not.toThrow();
    });

    it('should track client count correctly', () => {
      expect(statusBroadcastService.getClientCount()).toBe(0);
      
      // Mock response object
      const mockResponse = {
        writeHead: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn()
      };

      statusBroadcastService.addClient('test-client', mockResponse as any);
      expect(statusBroadcastService.getClientCount()).toBe(1);

      statusBroadcastService.removeClient('test-client');
      expect(statusBroadcastService.getClientCount()).toBe(0);
    });
  });

  describe('MachineController Integration', () => {
    it('should have SSE endpoint methods', () => {
      expect(typeof machineController.getStatusUpdates).toBe('function');
      expect(typeof machineController.getStatusPolling).toBe('function');
      expect(typeof machineController.getBroadcastStats).toBe('function');
    });

    it('should return broadcast statistics', () => {
      const stats = machineController.getBroadcastStats();
      
      expect(stats).toHaveProperty('connectedClients');
      expect(stats).toHaveProperty('clientIds');
      expect(stats).toHaveProperty('pingIntervalActive');
      expect(typeof stats.connectedClients).toBe('number');
      expect(Array.isArray(stats.clientIds)).toBe(true);
      expect(typeof stats.pingIntervalActive).toBe('boolean');
    });
  });

  describe('API Endpoints', () => {
    it('should have polling endpoint available', async () => {
      const response = await request(app)
        .get('/api/machines/status/polling')
        .expect(200);

      expect(response.body).toHaveProperty('machines');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('clientCount');
      expect(Array.isArray(response.body.machines)).toBe(true);
      expect(typeof response.body.timestamp).toBe('number');
      expect(typeof response.body.clientCount).toBe('number');
    });

    it('should have SSE endpoint available', (done) => {
      const req = request(app)
        .get('/api/machines/status')
        .expect(200)
        .expect('Content-Type', 'text/event-stream')
        .expect('Cache-Control', 'no-cache')
        .expect('Connection', 'keep-alive');

      // Set a timeout to close the connection after receiving headers
      setTimeout(() => {
        req.abort();
        done();
      }, 100);

      req.end((err) => {
        if (err && err.code !== 'ECONNRESET') {
          done(err);
        }
      });
    }, 1000);
  });
});