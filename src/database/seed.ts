import { getDatabase, closeDatabase } from './connection';

export interface SeedMachine {
  name: string;
  status: 'available' | 'in-use';
  timerEndTime?: number;
}

/**
 * Default seed data for laundry machines
 * Provides a realistic set of machines for a typical laundry facility
 */
export const DEFAULT_MACHINES: SeedMachine[] = [
  { name: 'Washer 1', status: 'available' },
  { name: 'Washer 2', status: 'available' },
  { name: 'Washer 3', status: 'available' },
  { name: 'Washer 4', status: 'available' },
  { name: 'Dryer 1', status: 'available' },
  { name: 'Dryer 2', status: 'available' },
  { name: 'Dryer 3', status: 'available' },
  { name: 'Dryer 4', status: 'available' },
  { name: 'Heavy Duty Washer', status: 'available' },
  { name: 'Heavy Duty Dryer', status: 'available' }
];

export class DatabaseSeeder {
  /**
   * Seed the database with initial machine data
   */
  async seedMachines(machines: SeedMachine[] = DEFAULT_MACHINES): Promise<void> {
    try {
      console.log('Starting database seeding...');
      
      const db = await getDatabase();
      
      // Check if machines already exist
      const existingCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM machines');
      
      if (existingCount && existingCount.count > 0) {
        console.log(`Database already contains ${existingCount.count} machines. Skipping seed.`);
        return;
      }

      // Insert seed data
      let insertedCount = 0;
      for (const machine of machines) {
        try {
          await db.run(
            'INSERT OR IGNORE INTO machines (name, status, timer_end_time) VALUES (?, ?, ?)',
            [machine.name, machine.status, machine.timerEndTime || null]
          );
          insertedCount++;
          console.log(`✓ Seeded machine: ${machine.name}`);
        } catch (error) {
          console.error(`✗ Failed to seed machine ${machine.name}:`, error);
          throw error;
        }
      }

      console.log(`✓ Successfully seeded ${insertedCount} machines`);
      
      // Verify seeding
      await this.verifySeed();
      
    } catch (error) {
      console.error('Database seeding failed:', error);
      throw new Error(`Seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all machine data and reseed
   */
  async reseed(machines: SeedMachine[] = DEFAULT_MACHINES): Promise<void> {
    try {
      console.log('Reseeding database...');
      
      const db = await getDatabase();
      
      // Clear existing data
      await db.run('DELETE FROM machines');
      console.log('✓ Cleared existing machine data');
      
      // Reset auto-increment counter
      await db.run('DELETE FROM sqlite_sequence WHERE name = "machines"');
      console.log('✓ Reset auto-increment counter');
      
      // Seed with new data
      await this.seedMachines(machines);
      
      console.log('✓ Database reseeding completed');
      
    } catch (error) {
      console.error('Database reseeding failed:', error);
      throw error;
    }
  }

  /**
   * Verify that seeding was successful
   */
  private async verifySeed(): Promise<void> {
    try {
      const db = await getDatabase();
      
      // Check total count
      const totalCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM machines');
      console.log(`✓ Total machines in database: ${totalCount?.count || 0}`);
      
      // Check status distribution
      const statusCounts = await db.all<{ status: string; count: number }>(
        'SELECT status, COUNT(*) as count FROM machines GROUP BY status'
      );
      
      for (const statusCount of statusCounts) {
        console.log(`✓ ${statusCount.status}: ${statusCount.count} machines`);
      }
      
      // Verify all machines are available initially
      const availableCount = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM machines WHERE status = "available"'
      );
      
      if (availableCount && availableCount.count === totalCount?.count) {
        console.log('✓ All seeded machines are available as expected');
      } else {
        console.warn('⚠ Some machines are not in available status');
      }
      
    } catch (error) {
      console.error('Seed verification failed:', error);
      throw error;
    }
  }

  /**
   * Get current machine statistics
   */
  async getStats(): Promise<{ total: number; available: number; inUse: number }> {
    try {
      const db = await getDatabase();
      
      const total = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM machines');
      const available = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM machines WHERE status = "available"'
      );
      const inUse = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM machines WHERE status = "in-use"'
      );
      
      return {
        total: total?.count || 0,
        available: available?.count || 0,
        inUse: inUse?.count || 0
      };
    } catch (error) {
      console.error('Failed to get machine statistics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const seeder = new DatabaseSeeder();

// CLI script functionality
if (require.main === module) {
  const command = process.argv[2];
  
  async function runCommand() {
    try {
      switch (command) {
        case 'seed':
          await seeder.seedMachines();
          break;
        case 'reseed':
          await seeder.reseed();
          break;
        case 'stats':
          const stats = await seeder.getStats();
          console.log('Machine Statistics:');
          console.log(`  Total: ${stats.total}`);
          console.log(`  Available: ${stats.available}`);
          console.log(`  In Use: ${stats.inUse}`);
          break;
        default:
          console.log('Usage: ts-node src/database/seed.ts [seed|reseed|stats]');
          console.log('  seed   - Seed database with initial machines (if empty)');
          console.log('  reseed - Clear and reseed database with fresh data');
          console.log('  stats  - Show current machine statistics');
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