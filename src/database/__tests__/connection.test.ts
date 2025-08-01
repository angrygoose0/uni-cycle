import { DatabaseManager, getDatabase, closeDatabase } from '../connection';
import fs from 'fs';
import path from 'path';

describe('Database Connection', () => {
  let testDbPath: string;
  let originalDbPath: string | undefined;

  beforeAll(() => {
    originalDbPath = process.env.DATABASE_PATH;
    testDbPath = path.join(process.cwd(), 'data', 'test-connection.db');
    process.env.DATABASE_PATH = testDbPath;
  });

  afterAll(async () => {
    await DatabaseManager.resetInstance();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (originalDbPath) {
      process.env.DATABASE_PATH = originalDbPath;
    } else {
      delete process.env.DATABASE_PATH;
    }
  });

  beforeEach(async () => {
    await DatabaseManager.resetInstance();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Connection Management', () => {
    it('should create database file and directory if they do not exist', async () => {
      const dataDir = path.dirname(testDbPath);
      
      // Ensure directory doesn't exist
      if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true });
      }
      
      const db = await getDatabase();
      
      expect(fs.existsSync(dataDir)).toBe(true);
      expect(fs.existsSync(testDbPath)).toBe(true);
      
      await closeDatabase();
    });

    it('should establish connection successfully', async () => {
      const db = await getDatabase();
      
      expect(db).toBeDefined();
      expect(db.run).toBeDefined();
      expect(db.get).toBeDefined();
      expect(db.all).toBeDefined();
      expect(db.close).toBeDefined();
      
      await closeDatabase();
    });

    it('should return same connection instance on multiple calls', async () => {
      const db1 = await getDatabase();
      const db2 = await getDatabase();
      
      expect(db1).toBe(db2);
      
      await closeDatabase();
    });

    it('should handle database operations correctly', async () => {
      const db = await getDatabase();
      
      // Test run operation
      await db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      
      // Test insert
      const result = await db.run('INSERT INTO test (name) VALUES (?)', ['test-name']);
      expect(result.lastID).toBeDefined();
      
      // Test get operation
      const row = await db.get<{ id: number; name: string }>('SELECT * FROM test WHERE id = ?', [result.lastID]);
      expect(row).toBeDefined();
      expect(row?.name).toBe('test-name');
      
      // Test all operation
      const rows = await db.all<{ id: number; name: string }>('SELECT * FROM test');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('test-name');
      
      await closeDatabase();
    });

    it('should handle connection errors gracefully', async () => {
      // Set an invalid database path (read-only directory)
      const invalidPath = '/invalid/path/database.db';
      process.env.DATABASE_PATH = invalidPath;
      
      await DatabaseManager.resetInstance();
      
      await expect(getDatabase()).rejects.toThrow(/Database connection failed/);
      
      // Restore valid path
      process.env.DATABASE_PATH = testDbPath;
      await DatabaseManager.resetInstance();
    }, 10000); // Increase timeout to 10 seconds

    it('should close connection properly', async () => {
      const db = await getDatabase();
      
      // Verify connection works
      await db.run('SELECT 1');
      
      await closeDatabase();
      
      // After closing, should be able to reconnect
      const newDb = await getDatabase();
      await newDb.run('SELECT 1');
      
      await closeDatabase();
    });
  });

  describe('Error Handling', () => {
    it('should handle SQL errors in run operations', async () => {
      const db = await getDatabase();
      
      await expect(db.run('INVALID SQL STATEMENT')).rejects.toThrow(/Database operation failed/);
      
      await closeDatabase();
    });

    it('should handle SQL errors in get operations', async () => {
      const db = await getDatabase();
      
      await expect(db.get('INVALID SQL STATEMENT')).rejects.toThrow(/Database query failed/);
      
      await closeDatabase();
    });

    it('should handle SQL errors in all operations', async () => {
      const db = await getDatabase();
      
      await expect(db.all('INVALID SQL STATEMENT')).rejects.toThrow(/Database query failed/);
      
      await closeDatabase();
    });

    it('should throw error when trying to use connection before connecting', async () => {
      await DatabaseManager.resetInstance();
      const manager = DatabaseManager.getInstance();
      
      expect(() => manager.getConnection()).toThrow(/Database not connected/);
    });
  });
});