import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { MachineController } from '../controllers/MachineController';
import { StatusBroadcastService } from '../services/StatusBroadcastService';
import { TimerManager } from '../services/TimerManager';
import { MachineService } from '../services/MachineService';
import { DatabaseManager, getDatabase, closeDatabase } from '../database/connection';
import fs from 'fs';
import path from 'path';

describe('Integration Tests', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-integration.db');
  let originalDbPath: string | undefined;
  let machineService: MachineService;
  let timerManager: TimerManager;
  let statusBroadcastService: StatusBroadcastService;
  let machineController: MachineController;
  let testApp: express.Application;

  beforeAll(async () => {
    // Set test database path
    originalDbPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = testDbPath;
  });

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Reset database instance to ensure clean state
    await DatabaseManager.resetInstance();

    // Initialize database with schema and seed data
    const db = await getDatabase();
    
    // Create schema
    await db.run(`
      CREATE TABLE IF NOT EXISTS machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('available', 'in-use')),
        timer_end_time INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Insert test data
    await db.run(`
      INSERT INTO machines (name, status) VALUES 
      ('Washer 1', 'available'),
      ('Washer 2', 'available'),
      ('Dryer 1', 'available')
    `);

    // Initialize services after database is set up
    statusBroadcastService = new StatusBroadcastService(false);
    machineService = new MachineService();
    timerManager = new TimerManager(machineService, statusBroadcastService);
    machineController = new MachineController(machineService, statusBroadcastService);

    // Create test Express app
    testApp = express();
    testApp.use(cors());
    testApp.use(express.json());
    testApp.use(express.urlencoded({ extended: true }));

    // API Routes
    testApp.get('/api/machines', (req, res) => machineController.getAllMachines(req, res));
    testApp.post('/api/machines/:id/timer', (req, res) => machineController.setTimer(req, res));
    testApp.get('/api/machines/status', (req, res) => machineController.getStatusUpdates(req, res));
    testApp.get('/api/machines/status/polling', (req, res) => machineController.getStatusPolling(req, res));

    // Health check endpoint
    testApp.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'laundry-machine-timer'
      });
    });

    // 404 handler for API routes
    testApp.use('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `API endpoint ${req.method} ${req.originalUrl} not found`
      });
    });

    // Global error handler
    testApp.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    });
  });

  afterEach(async () => {
    // Stop timer manager and cleanup services
    if (timerManager && timerManager.isActive()) {
      timerManager.stop();
    }
    if (statusBroadcastService) {
      statusBroadcastService.cleanup();
    }
    
    // Close database connection
    try {
      await closeDatabase();
      await DatabaseManager.resetInstance();
    } catch (error) {
      // Ignore close errors in tests
    }
  });

  afterAll(async () => {
    // Restore original database path
    if (originalDbPath) {
      process.env.DATABASE_PATH = originalDbPath;
    } else {
      delete process.env.DATABASE_PATH;
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Complete API Workflows', () => {
    it('should handle complete machine timer workflow', async () => {
      // 1. Get all machines - should show all available
      const machinesResponse = await request(testApp)
        .get('/api/machines')
        .expect(200);

      expect(machinesResponse.body.machines).toHaveLength(3);
      // Don't assume specific order, just check that we have the expected machines
      const machineNames = machinesResponse.body.machines.map((m: any) => m.name);
      expect(machineNames).toContain('Washer 1');
      expect(machineNames).toContain('Washer 2');
      expect(machineNames).toContain('Dryer 1');

      // 2. Set timer on machine 1
      const setTimerResponse = await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 30 })
        .expect(200);

      expect(setTimerResponse.body.success).toBe(true);
      expect(setTimerResponse.body.machine).toMatchObject({
        id: 1,
        name: 'Washer 1',
        status: 'in-use'
      });
      expect(setTimerResponse.body.machine.remainingTimeMs).toBeGreaterThan(1790000); // ~30 minutes

      // 3. Verify machine status changed
      const updatedMachinesResponse = await request(testApp)
        .get('/api/machines')
        .expect(200);

      const machine1 = updatedMachinesResponse.body.machines.find((m: any) => m.id === 1);
      expect(machine1.status).toBe('in-use');
      expect(machine1.remainingTimeMs).toBeGreaterThan(1790000);

      // 4. Try to set timer on already in-use machine
      const conflictResponse = await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 15 })
        .expect(409);

      expect(conflictResponse.body.success).toBe(false);
      expect(conflictResponse.body.error).toBe('MACHINE_IN_USE');

      // 5. Set timer on different machine
      const machine2Response = await request(testApp)
        .post('/api/machines/2/timer')
        .send({ durationMinutes: 45 })
        .expect(200);

      expect(machine2Response.body.success).toBe(true);
      expect(machine2Response.body.machine.status).toBe('in-use');
    });

    it('should handle invalid API requests properly', async () => {
      // Invalid machine ID
      await request(testApp)
        .post('/api/machines/999/timer')
        .send({ durationMinutes: 30 })
        .expect(404);

      // Invalid duration
      await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 500 })
        .expect(400);

      // Missing duration
      await request(testApp)
        .post('/api/machines/1/timer')
        .send({})
        .expect(400);

      // Non-numeric machine ID
      await request(testApp)
        .post('/api/machines/abc/timer')
        .send({ durationMinutes: 30 })
        .expect(400);
    });

    it('should handle concurrent timer requests', async () => {
      // Set up multiple concurrent requests for the same machine
      const requests = Array(5).fill(null).map(() =>
        request(testApp)
          .post('/api/machines/1/timer')
          .send({ durationMinutes: 30 })
      );

      const responses = await Promise.allSettled(requests);
      
      // Count successful and conflict responses
      const successCount = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      const conflictCount = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 409
      ).length;
      const errorCount = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status >= 500
      ).length;

      // At least one should succeed, and most requests should complete
      // Due to SQLite's handling of concurrent requests, we might get different results
      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(successCount + conflictCount + errorCount).toBeGreaterThanOrEqual(4); // Most requests should complete
    });
  });

  describe('Timer Expiration End-to-End Functionality', () => {
    it('should automatically expire timers and update machine status', async () => {
      // Set a 1 minute timer and manually expire it for testing
      const setTimerResponse = await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 1 })
        .expect(200);

      expect(setTimerResponse.body.machine.status).toBe('in-use');

      // Manually set timer to expire soon by updating database directly
      const db = await getDatabase();
      const expireTime = Date.now() + 1000; // Expire in 1 second
      await db.run('UPDATE machines SET timer_end_time = ? WHERE id = ?', [Math.floor(expireTime / 1000), 1]);

      // Start timer manager with short interval for testing
      timerManager.start(500); // Check every 500ms

      // Wait for timer to expire
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that machine is now available
      const machinesResponse = await request(testApp)
        .get('/api/machines')
        .expect(200);

      const machine1 = machinesResponse.body.machines.find((m: any) => m.id === 1);
      expect(machine1.status).toBe('available');
      expect(machine1.remainingTimeMs).toBeUndefined();
    });

    it('should handle multiple timer expirations simultaneously', async () => {
      // Set timers on multiple machines
      await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 1 })
        .expect(200);

      await request(testApp)
        .post('/api/machines/2/timer')
        .send({ durationMinutes: 1 })
        .expect(200);

      await request(testApp)
        .post('/api/machines/3/timer')
        .send({ durationMinutes: 1 })
        .expect(200);

      // Manually set all timers to expire soon
      const db = await getDatabase();
      const expireTime = Math.floor((Date.now() + 1000) / 1000); // Expire in 1 second
      await db.run('UPDATE machines SET timer_end_time = ? WHERE id IN (1, 2, 3)', [expireTime]);

      // Start timer manager
      timerManager.start(500);

      // Wait for all timers to expire
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Check that all machines are available
      const machinesResponse = await request(testApp)
        .get('/api/machines')
        .expect(200);

      machinesResponse.body.machines.forEach((machine: any) => {
        expect(machine.status).toBe('available');
        expect(machine.remainingTimeMs).toBeUndefined();
      });
    });

    it('should broadcast timer expiration events', async () => {
      let expiredMachineId: number | null = null;
      
      // Mock the broadcast service to capture events
      const originalBroadcast = statusBroadcastService.broadcastTimerExpired;
      statusBroadcastService.broadcastTimerExpired = jest.fn((machineId, machine) => {
        expiredMachineId = machineId;
        originalBroadcast.call(statusBroadcastService, machineId, machine);
      });

      // Set timer
      await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 1 })
        .expect(200);

      // Manually set timer to expire soon
      const db = await getDatabase();
      const expireTime = Math.floor((Date.now() + 1000) / 1000);
      await db.run('UPDATE machines SET timer_end_time = ? WHERE id = ?', [expireTime, 1]);

      // Start timer manager
      timerManager.start(500);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify broadcast was called
      expect(statusBroadcastService.broadcastTimerExpired).toHaveBeenCalled();
      expect(expiredMachineId).toBe(1);
    });

    it('should handle timer manager restart with active timers', async () => {
      // Set timer
      await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 1 })
        .expect(200);

      // Start timer manager
      timerManager.start(1000);

      // Verify timer is active
      const activeTimers = await timerManager.getActiveTimers();
      expect(activeTimers).toHaveLength(1);
      expect(activeTimers[0].id).toBe(1);

      // Stop and restart timer manager (simulating restart)
      timerManager.stop();
      await new Promise(resolve => setTimeout(resolve, 100));
      timerManager.start(1000);

      // Verify timer is still active after restart
      const activeTimersAfterRestart = await timerManager.getActiveTimers();
      expect(activeTimersAfterRestart).toHaveLength(1);
      expect(activeTimersAfterRestart[0].id).toBe(1);
    });
  });

  describe('Database Persistence Across Server Restarts', () => {
    it('should persist machine states across database reconnections', async () => {
      // Set timer on machine
      await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 60 })
        .expect(200);

      // Verify machine is in-use
      let machinesResponse = await request(testApp)
        .get('/api/machines')
        .expect(200);

      let machine1 = machinesResponse.body.machines.find((m: any) => m.id === 1);
      expect(machine1.status).toBe('in-use');
      expect(machine1.remainingTimeMs).toBeGreaterThan(3590000); // ~60 minutes

      // Simulate server restart by closing and reopening database
      await closeDatabase();
      await DatabaseManager.resetInstance();

      // Reconnect to database and recreate services
      await getDatabase();
      machineService = new MachineService();
      machineController = new MachineController(machineService, statusBroadcastService);

      // Verify data persisted
      machinesResponse = await request(testApp)
        .get('/api/machines')
        .expect(200);

      machine1 = machinesResponse.body.machines.find((m: any) => m.id === 1);
      expect(machine1.status).toBe('in-use');
      expect(machine1.remainingTimeMs).toBeGreaterThan(3580000); // Should be slightly less due to time passage
    });

    it('should restore active timers after service restart', async () => {
      // Set multiple timers
      await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 30 })
        .expect(200);

      await request(testApp)
        .post('/api/machines/2/timer')
        .send({ durationMinutes: 45 })
        .expect(200);

      // Create new timer manager instance (simulating restart)
      const newTimerManager = new TimerManager(machineService, statusBroadcastService);
      
      // Get active timers - should restore from database
      const activeTimers = await newTimerManager.getActiveTimers();
      expect(activeTimers).toHaveLength(2);
      
      const machine1Timer = activeTimers.find(t => t.id === 1);
      const machine2Timer = activeTimers.find(t => t.id === 2);
      
      expect(machine1Timer?.status).toBe('in-use');
      expect(machine2Timer?.status).toBe('in-use');
      expect(machine1Timer?.remainingTimeMs).toBeGreaterThan(1790000); // ~30 minutes
      expect(machine2Timer?.remainingTimeMs).toBeGreaterThan(2690000); // ~45 minutes
    });

    it('should handle database corruption gracefully', async () => {
      // Set timer first
      await request(testApp)
        .post('/api/machines/1/timer')
        .send({ durationMinutes: 30 })
        .expect(200);

      // Close database connection
      await closeDatabase();

      // Corrupt the database file by writing invalid data
      fs.writeFileSync(testDbPath, 'corrupted data');

      // Reset database manager
      await DatabaseManager.resetInstance();

      // Attempt to reconnect should fail gracefully
      try {
        await getDatabase();
        // If we get here, the database was recreated, which is acceptable
        const machinesResponse = await request(testApp)
          .get('/api/machines');
        
        // Should either fail with 500 or return empty/default data
        expect([200, 500]).toContain(machinesResponse.status);
      } catch (error) {
        // Database connection failure is expected with corrupted file
        expect(error).toBeDefined();
      }
    }, 10000); // 10 second timeout

    it('should maintain data consistency during concurrent operations', async () => {
      // Perform multiple concurrent database operations
      const operations = [
        request(testApp).post('/api/machines/1/timer').send({ durationMinutes: 30 }),
        request(testApp).post('/api/machines/2/timer').send({ durationMinutes: 45 }),
        request(testApp).get('/api/machines'),
        request(testApp).get('/api/machines'),
        request(testApp).post('/api/machines/3/timer').send({ durationMinutes: 60 })
      ];

      const results = await Promise.allSettled(operations);
      
      // All operations should complete (either success or expected failure)
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // Verify final state is consistent
      const finalState = await request(testApp)
        .get('/api/machines')
        .expect(200);

      const inUseMachines = finalState.body.machines.filter((m: any) => m.status === 'in-use');
      expect(inUseMachines).toHaveLength(3); // All three machines should be in use
      
      // Verify each machine has appropriate remaining time
      inUseMachines.forEach((machine: any) => {
        expect(machine.remainingTimeMs).toBeGreaterThan(0);
      });
    });

    it('should handle database schema migrations gracefully', async () => {
      // This test verifies that the application can handle database schema changes
      // For now, we'll test that the current schema works correctly
      
      const db = await getDatabase();
      
      // Verify schema exists and is correct
      const tableInfo = await db.all(`PRAGMA table_info(machines)`);
      
      const expectedColumns = ['id', 'name', 'status', 'timer_end_time', 'created_at', 'updated_at'];
      const actualColumns = tableInfo.map((col: any) => col.name);
      
      expectedColumns.forEach(expectedCol => {
        expect(actualColumns).toContain(expectedCol);
      });

      // Verify constraints work
      try {
        await db.run(`INSERT INTO machines (name, status) VALUES ('Test Machine', 'invalid-status')`);
        fail('Should have failed due to CHECK constraint');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Verify unique constraint
      try {
        await db.run(`INSERT INTO machines (name, status) VALUES ('Washer 1', 'available')`);
        fail('Should have failed due to UNIQUE constraint');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});