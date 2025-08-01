import { DatabaseSeeder, DEFAULT_MACHINES, SeedMachine } from '../seed';
import { DatabaseManager } from '../connection';
import { migrator } from '../migrate';
import fs from 'fs';
import path from 'path';

describe('DatabaseSeeder', () => {
  let seeder: DatabaseSeeder;
  let testDbPath: string;

  beforeAll(async () => {
    // Use a test database
    testDbPath = path.join(process.cwd(), 'data', 'test-seed.db');
    process.env.DATABASE_PATH = testDbPath;
    
    seeder = new DatabaseSeeder();
    
    // Ensure clean state
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Run migration first
    await migrator.migrate();
  });

  afterAll(async () => {
    // Clean up
    await DatabaseManager.resetInstance();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    delete process.env.DATABASE_PATH;
  });

  beforeEach(async () => {
    // Reset database state before each test
    await migrator.reset();
  });

  describe('seedMachines', () => {
    it('should seed database with default machines', async () => {
      const stats = await seeder.getStats();
      
      expect(stats.total).toBe(DEFAULT_MACHINES.length);
      expect(stats.available).toBe(DEFAULT_MACHINES.length);
      expect(stats.inUse).toBe(0);
    });

    it('should not seed if machines already exist', async () => {
      // Database should already have machines from beforeEach reset
      const initialStats = await seeder.getStats();
      
      // Try to seed again
      await seeder.seedMachines();
      
      const finalStats = await seeder.getStats();
      expect(finalStats.total).toBe(initialStats.total);
    });

    it('should seed with custom machine data', async () => {
      // Clear existing data first
      await seeder.reseed([]);
      
      const customMachines: SeedMachine[] = [
        { name: 'Test Washer 1', status: 'available' },
        { name: 'Test Dryer 1', status: 'available' }
      ];
      
      await seeder.seedMachines(customMachines);
      
      const stats = await seeder.getStats();
      expect(stats.total).toBe(2);
      expect(stats.available).toBe(2);
    });
  });

  describe('reseed', () => {
    it('should clear existing data and reseed', async () => {
      const initialStats = await seeder.getStats();
      expect(initialStats.total).toBeGreaterThan(0);
      
      const customMachines: SeedMachine[] = [
        { name: 'New Machine 1', status: 'available' }
      ];
      
      await seeder.reseed(customMachines);
      
      const finalStats = await seeder.getStats();
      expect(finalStats.total).toBe(1);
      expect(finalStats.available).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return accurate machine statistics', async () => {
      const stats = await seeder.getStats();
      
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.available).toBe('number');
      expect(typeof stats.inUse).toBe('number');
      expect(stats.total).toBe(stats.available + stats.inUse);
    });
  });
});