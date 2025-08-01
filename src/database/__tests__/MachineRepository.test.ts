import { MachineRepository } from '../MachineRepository';
import { DatabaseConnection, DatabaseManager } from '../connection';
import { Machine } from '../../models/Machine';
import fs from 'fs';
import path from 'path';

describe('MachineRepository', () => {
  let repository: MachineRepository;
  let db: DatabaseConnection;
  let testDbPath: string;

  beforeAll(async () => {
    // Create a test database in memory or temp directory
    testDbPath = path.join(__dirname, 'test.db');
    process.env.DATABASE_PATH = testDbPath;
    
    // Get fresh database connection
    const dbManager = DatabaseManager.getInstance();
    db = await dbManager.connect();
    
    // Create tables
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

    repository = new MachineRepository(db);
  });

  beforeEach(async () => {
    // Clear the machines table before each test
    await db.run('DELETE FROM machines');
  });

  afterAll(async () => {
    await DatabaseManager.resetInstance();
    
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    delete process.env.DATABASE_PATH;
  });

  describe('findAll', () => {
    it('should return empty array when no machines exist', async () => {
      const machines = await repository.findAll();
      expect(machines).toEqual([]);
    });

    it('should return all machines ordered by name', async () => {
      // Insert test data
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Washer B', 'available', 1000, 1000]);
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Washer A', 'in-use', futureTime, 1000, 1000]);

      const machines = await repository.findAll();
      expect(machines).toHaveLength(2);
      expect(machines[0].name).toBe('Washer A');
      expect(machines[1].name).toBe('Washer B');
    });
  });

  describe('findById', () => {
    it('should return null when machine does not exist', async () => {
      const machine = await repository.findById(999);
      expect(machine).toBeNull();
    });

    it('should return machine when it exists', async () => {
      const result = await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Test Washer', 'available', 1000, 1000]);
      
      const machine = await repository.findById(result.lastID!);
      expect(machine).not.toBeNull();
      expect(machine!.name).toBe('Test Washer');
      expect(machine!.status).toBe('available');
    });
  });

  describe('findByName', () => {
    it('should return null when machine does not exist', async () => {
      const machine = await repository.findByName('Nonexistent');
      expect(machine).toBeNull();
    });

    it('should return machine when it exists', async () => {
      await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Test Washer', 'available', 1000, 1000]);
      
      const machine = await repository.findByName('Test Washer');
      expect(machine).not.toBeNull();
      expect(machine!.name).toBe('Test Washer');
    });
  });

  describe('findWithActiveTimers', () => {
    it('should return only machines with active timers', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Available Machine', 'available', null, 1000, 1000]);
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Active Machine', 'in-use', futureTime, 1000, 1000]);

      const machines = await repository.findWithActiveTimers();
      expect(machines).toHaveLength(1);
      expect(machines[0].name).toBe('Active Machine');
      expect(machines[0].status).toBe('in-use');
    });
  });

  describe('findWithExpiredTimers', () => {
    it('should return only machines with expired timers', async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Expired Machine', 'in-use', pastTime, 1000, 1000]);
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Active Machine', 'in-use', futureTime, 1000, 1000]);

      const machines = await repository.findWithExpiredTimers();
      expect(machines).toHaveLength(1);
      expect(machines[0].name).toBe('Expired Machine');
    });
  });

  describe('create', () => {
    it('should create a new machine', async () => {
      const now = Math.floor(Date.now() / 1000);
      const machineData = {
        name: 'New Washer',
        status: 'available' as const,
        createdAt: now,
        updatedAt: now
      };

      const created = await repository.create(machineData);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('New Washer');
      expect(created.status).toBe('available');
    });

    it('should throw error when creating machine with duplicate name', async () => {
      const now = Math.floor(Date.now() / 1000);
      const machineData = {
        name: 'Duplicate Washer',
        status: 'available' as const,
        createdAt: now,
        updatedAt: now
      };

      await repository.create(machineData);
      
      await expect(repository.create(machineData)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update an existing machine', async () => {
      const result = await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Test Washer', 'available', 1000, 1000]);
      
      const machine = await repository.findById(result.lastID!);
      machine!.status = 'in-use';
      machine!.timerEndTime = Math.floor(Date.now() / 1000) + 3600;

      const updated = await repository.update(machine!);
      expect(updated.status).toBe('in-use');
      expect(updated.timerEndTime).toBeDefined();
    });

    it('should throw error when updating non-existent machine', async () => {
      const now = Math.floor(Date.now() / 1000);
      const fakeMachine = new Machine({
        id: 999,
        name: 'Fake Machine',
        status: 'available',
        createdAt: now,
        updatedAt: now
      });

      await expect(repository.update(fakeMachine)).rejects.toThrow('Machine with id 999 not found');
    });
  });

  describe('delete', () => {
    it('should delete an existing machine', async () => {
      const result = await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Test Washer', 'available', 1000, 1000]);
      
      const deleted = await repository.delete(result.lastID!);
      expect(deleted).toBe(true);

      const machine = await repository.findById(result.lastID!);
      expect(machine).toBeNull();
    });

    it('should return false when deleting non-existent machine', async () => {
      const deleted = await repository.delete(999);
      expect(deleted).toBe(false);
    });
  });

  describe('setTimer', () => {
    it('should set timer for available machine', async () => {
      const result = await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Test Washer', 'available', 1000, 1000]);
      
      const updated = await repository.setTimer(result.lastID!, 60);
      expect(updated.status).toBe('in-use');
      expect(updated.timerEndTime).toBeDefined();
      expect(updated.timerEndTime! > Math.floor(Date.now() / 1000)).toBe(true);
    });

    it('should throw error when setting timer on non-existent machine', async () => {
      await expect(repository.setTimer(999, 60)).rejects.toThrow('Machine with id 999 not found');
    });
  });

  describe('clearTimer', () => {
    it('should clear timer and make machine available', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const result = await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Test Washer', 'in-use', futureTime, 1000, 1000]);
      
      const updated = await repository.clearTimer(result.lastID!);
      expect(updated.status).toBe('available');
      expect(updated.timerEndTime).toBeUndefined();
    });

    it('should throw error when clearing timer on non-existent machine', async () => {
      await expect(repository.clearTimer(999)).rejects.toThrow('Machine with id 999 not found');
    });
  });

  describe('updateStatus', () => {
    it('should update machine status', async () => {
      const result = await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Test Washer', 'available', 1000, 1000]);
      
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const updated = await repository.updateStatus(result.lastID!, 'in-use', futureTime);
      
      expect(updated.status).toBe('in-use');
      expect(updated.timerEndTime).toBe(futureTime);
    });

    it('should throw error when updating non-existent machine', async () => {
      await expect(repository.updateStatus(999, 'available')).rejects.toThrow('Machine with id 999 not found');
    });
  });

  describe('clearExpiredTimers', () => {
    it('should clear all expired timers', async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Expired 1', 'in-use', pastTime, 1000, 1000]);
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Expired 2', 'in-use', pastTime, 1000, 1000]);
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['Active', 'in-use', futureTime, 1000, 1000]);

      const clearedCount = await repository.clearExpiredTimers();
      expect(clearedCount).toBe(2);

      const machines = await repository.findAll();
      const availableMachines = machines.filter(m => m.status === 'available');
      const inUseMachines = machines.filter(m => m.status === 'in-use');
      
      expect(availableMachines).toHaveLength(2);
      expect(inUseMachines).toHaveLength(1);
    });
  });

  describe('getCountByStatus', () => {
    it('should return correct counts by status', async () => {
      await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Available 1', 'available', 1000, 1000]);
      await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Available 2', 'available', 1000, 1000]);
      await db.run('INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        ['In Use', 'in-use', Math.floor(Date.now() / 1000) + 3600, 1000, 1000]);

      const counts = await repository.getCountByStatus();
      expect(counts.available).toBe(2);
      expect(counts.inUse).toBe(1);
    });
  });

  describe('existsByName', () => {
    it('should return true when machine exists', async () => {
      await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Test Washer', 'available', 1000, 1000]);
      
      const exists = await repository.existsByName('Test Washer');
      expect(exists).toBe(true);
    });

    it('should return false when machine does not exist', async () => {
      const exists = await repository.existsByName('Nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('existsById', () => {
    it('should return true when machine exists', async () => {
      const result = await db.run('INSERT INTO machines (name, status, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        ['Test Washer', 'available', 1000, 1000]);
      
      const exists = await repository.existsById(result.lastID!);
      expect(exists).toBe(true);
    });

    it('should return false when machine does not exist', async () => {
      const exists = await repository.existsById(999);
      expect(exists).toBe(false);
    });
  });
});