import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

// Enable verbose mode for better debugging
const sqlite = sqlite3.verbose();

export interface DatabaseConnection {
  db: sqlite3.Database;
  run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  get: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
  all: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  close: () => Promise<void>;
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private connection: DatabaseConnection | null = null;

  private constructor() {
    // Constructor is now empty - path is determined dynamically
  }

  private get dbPath(): string {
    // Use environment variable or default to local SQLite file
    return process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'laundry.db');
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public static async resetInstance(): Promise<void> {
    if (DatabaseManager.instance?.connection) {
      await DatabaseManager.instance.connection.close();
    }
    DatabaseManager.instance = null as any;
  }

  public async connect(): Promise<DatabaseConnection> {
    if (this.connection) {
      return this.connection;
    }

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
          try {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`Created data directory: ${dataDir}`);
          } catch (dirError) {
            throw new Error(`Failed to create data directory ${dataDir}: ${dirError instanceof Error ? dirError.message : 'Unknown error'}`);
          }
        }

        // Check if we have write permissions to the data directory
        try {
          fs.accessSync(dataDir, fs.constants.W_OK);
        } catch (permError) {
          throw new Error(`No write permission for data directory ${dataDir}`);
        }

        const db = await new Promise<sqlite3.Database>((resolve, reject) => {
          const database = new sqlite.Database(this.dbPath, (err) => {
            if (err) {
              console.error(`Error opening database (attempt ${retryCount + 1}/${maxRetries}):`, err.message);
              reject(new Error(`Database connection failed: ${err.message}`));
            } else {
              console.log('Connected to SQLite database at:', this.dbPath);
              resolve(database);
            }
          });
        });

        // Test the connection with a simple query
        await this.runQuery(db, 'SELECT 1');

        // Enable foreign key constraints
        await this.runQuery(db, 'PRAGMA foreign_keys = ON');
        
        // Set WAL mode for better concurrent access
        await this.runQuery(db, 'PRAGMA journal_mode = WAL');

        // Set reasonable timeout for busy database
        await this.runQuery(db, 'PRAGMA busy_timeout = 30000');

        // Create promisified methods for easier async/await usage
        const connection: DatabaseConnection = {
          db,
          run: (sql: string, params?: any[]) => {
            return new Promise((resolve, reject) => {
              db.run(sql, params || [], function(err) {
                if (err) {
                  console.error('Database run error:', err.message);
                  reject(new Error(`Database operation failed: ${err.message}`));
                } else {
                  resolve(this);
                }
              });
            });
          },
          get: <T = any>(sql: string, params?: any[]) => {
            return new Promise<T | undefined>((resolve, reject) => {
              db.get(sql, params || [], (err, row) => {
                if (err) {
                  console.error('Database get error:', err.message);
                  reject(new Error(`Database query failed: ${err.message}`));
                } else {
                  resolve(row as T | undefined);
                }
              });
            });
          },
          all: <T = any>(sql: string, params?: any[]) => {
            return new Promise<T[]>((resolve, reject) => {
              db.all(sql, params || [], (err, rows) => {
                if (err) {
                  console.error('Database all error:', err.message);
                  reject(new Error(`Database query failed: ${err.message}`));
                } else {
                  resolve((rows || []) as T[]);
                }
              });
            });
          },
          close: () => {
            return new Promise((resolve, reject) => {
              db.close((err) => {
                if (err) {
                  console.error('Database close error:', err.message);
                  reject(new Error(`Failed to close database: ${err.message}`));
                } else {
                  resolve();
                }
              });
            });
          }
        };

        this.connection = connection;
        console.log('✓ Database connection established successfully');
        return connection;

      } catch (error) {
        retryCount++;
        console.error(`Database connection attempt ${retryCount}/${maxRetries} failed:`, error instanceof Error ? error.message : 'Unknown error');
        
        if (retryCount >= maxRetries) {
          const errorMessage = `Database connection failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying database connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Database connection failed: Maximum retries exceeded');
  }

  public async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close();
        this.connection = null;
        console.log('Database connection closed');
      } catch (error) {
        console.error('Error closing database connection:', error);
        throw error;
      }
    }
  }

  public getConnection(): DatabaseConnection {
    if (!this.connection) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.connection;
  }

  private runQuery(db: sqlite3.Database, sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }
}

// Export singleton instance and class for testing
export const dbManager = DatabaseManager.getInstance();
export { DatabaseManager };

// Utility function to get database connection
export async function getDatabase(): Promise<DatabaseConnection> {
  return await dbManager.connect();
}

// Utility function to close database connection
export async function closeDatabase(): Promise<void> {
  await dbManager.disconnect();
}