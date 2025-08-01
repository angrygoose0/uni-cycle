import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

export interface DatabaseConnection {
  client: Client;
  run: (sql: string, params?: any[]) => Promise<{ lastInsertRowid: number; changes: number }>;
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

  private get dbConfig() {
    const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'laundry.db');
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    // Check if it's a Turso URL (starts with libsql://)
    if (databasePath.startsWith('libsql://')) {
      if (!authToken) {
        throw new Error('DATABASE_AUTH_TOKEN is required for Turso connections');
      }
      return {
        url: databasePath,
        authToken: authToken
      };
    }

    // Local SQLite file
    return {
      url: `file:${databasePath}`
    };
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
        const config = this.dbConfig;
        
        // For local SQLite files, ensure directory exists
        if (config.url.startsWith('file:')) {
          const filePath = config.url.replace('file:', '');
          const dataDir = path.dirname(filePath);
          if (!fs.existsSync(dataDir)) {
            try {
              fs.mkdirSync(dataDir, { recursive: true });
              console.log(`Created data directory: ${dataDir}`);
            } catch (dirError) {
              throw new Error(`Failed to create data directory ${dataDir}: ${dirError instanceof Error ? dirError.message : 'Unknown error'}`);
            }
          }
        }

        // Create libsql client
        const client = createClient(config);

        // Test the connection with a simple query
        await client.execute('SELECT 1');

        // Enable foreign key constraints and set pragmas
        await client.execute('PRAGMA foreign_keys = ON');
        
        // For local SQLite, set WAL mode and timeout
        if (config.url.startsWith('file:')) {
          await client.execute('PRAGMA journal_mode = WAL');
          await client.execute('PRAGMA busy_timeout = 30000');
        }

        // Create connection wrapper with consistent interface
        const connection: DatabaseConnection = {
          client,
          run: async (sql: string, params?: any[]) => {
            try {
              const result = await client.execute({
                sql,
                args: params || []
              });
              return {
                lastInsertRowid: Number(result.lastInsertRowid || 0),
                changes: result.rowsAffected
              };
            } catch (error) {
              console.error('Database run error:', error instanceof Error ? error.message : 'Unknown error');
              throw new Error(`Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          },
          get: async <T = any>(sql: string, params?: any[]): Promise<T | undefined> => {
            try {
              const result = await client.execute({
                sql,
                args: params || []
              });
              return result.rows[0] as T | undefined;
            } catch (error) {
              console.error('Database get error:', error instanceof Error ? error.message : 'Unknown error');
              throw new Error(`Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          },
          all: async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
            try {
              const result = await client.execute({
                sql,
                args: params || []
              });
              return result.rows as T[];
            } catch (error) {
              console.error('Database all error:', error instanceof Error ? error.message : 'Unknown error');
              throw new Error(`Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          },
          close: async () => {
            try {
              client.close();
            } catch (error) {
              console.error('Database close error:', error instanceof Error ? error.message : 'Unknown error');
              throw new Error(`Failed to close database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        };

        this.connection = connection;
        
        if (config.url.startsWith('libsql://')) {
          console.log('✓ Connected to Turso database successfully');
        } else {
          console.log('✓ Connected to local SQLite database successfully');
        }
        
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