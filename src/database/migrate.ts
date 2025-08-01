import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getDatabase, closeDatabase } from './connection';
import { seeder } from './seed';

// Load environment variables from .env file
dotenv.config();

export class DatabaseMigrator {
  private readonly schemaPath: string;

  constructor() {
    this.schemaPath = path.join(__dirname, 'schema.sql');
  }

  /**
   * Run database migrations to set up the initial schema
   */
  async migrate(): Promise<void> {
    try {
      console.log('Starting database migration...');
      
      // Read the schema file
      if (!fs.existsSync(this.schemaPath)) {
        throw new Error(`Schema file not found at: ${this.schemaPath}`);
      }

      const schemaSQL = fs.readFileSync(this.schemaPath, 'utf8');
      
      // Get database connection
      const db = await getDatabase();

      // Split the schema into individual statements
      const statements = schemaSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      // Execute each statement
      for (const statement of statements) {
        try {
          await db.run(statement);
          console.log('✓ Executed:', statement.substring(0, 50) + '...');
        } catch (error) {
          console.error('✗ Failed to execute statement:', statement.substring(0, 50) + '...');
          throw error;
        }
      }

      console.log('✓ Database migration completed successfully');
      
      // Verify the migration by checking if tables exist
      await this.verifyMigration(db);
      
    } catch (error) {
      console.error('Database migration failed:', error);
      throw error;
    }
  }

  /**
   * Verify that the migration was successful
   */
  private async verifyMigration(db: any): Promise<void> {
    try {
      // Check if machines table exists and has the expected structure
      const tableInfo = await db.all(`PRAGMA table_info(machines)`);
      
      if (tableInfo.length === 0) {
        throw new Error('Machines table was not created');
      }

      console.log('✓ Machines table structure verified');

      // Check if sample data was inserted
      const machineCount = await db.get(`SELECT COUNT(*) as count FROM machines`);
      console.log(`✓ Found ${machineCount.count} machines in database`);

      // Check indexes
      const indexes = await db.all(`PRAGMA index_list(machines)`);
      console.log(`✓ Found ${indexes.length} indexes on machines table`);

    } catch (error) {
      console.error('Migration verification failed:', error);
      throw error;
    }
  }

  /**
   * Complete database setup: migrate schema and seed initial data
   */
  async setup(): Promise<void> {
    try {
      console.log('Starting complete database setup...');
      
      // Run migration first
      await this.migrate();
      
      // Then seed the database
      await seeder.seedMachines();
      
      console.log('✓ Complete database setup finished successfully');
      
    } catch (error) {
      console.error('Database setup failed:', error);
      throw error;
    }
  }

  /**
   * Reset the database by dropping all tables and re-running migrations
   */
  async reset(): Promise<void> {
    try {
      console.log('Resetting database...');
      
      const db = await getDatabase();
      
      // Drop existing tables
      await db.run('DROP TABLE IF EXISTS machines');
      console.log('✓ Dropped existing tables');
      
      // Re-run migration
      await this.migrate();
      
      // Seed fresh data
      await seeder.seedMachines();
      
      console.log('✓ Database reset completed');
      
    } catch (error) {
      console.error('Database reset failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const migrator = new DatabaseMigrator();

// CLI script functionality
if (require.main === module) {
  const command = process.argv[2];
  
  async function runCommand() {
    try {
      switch (command) {
        case 'migrate':
          await migrator.migrate();
          break;
        case 'setup':
          await migrator.setup();
          break;
        case 'reset':
          await migrator.reset();
          break;
        default:
          console.log('Usage: ts-node src/database/migrate.ts [migrate|setup|reset]');
          console.log('  migrate - Run database migrations only');
          console.log('  setup   - Run migrations and seed initial data');
          console.log('  reset   - Reset database and run complete setup');
          process.exit(1);
      }
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  }
  
  runCommand();
}