import { DatabaseConnection, getDatabase } from './connection';
import { Machine } from '../models/Machine';
import { MachineRow, Machine as MachineInterface } from '../types';
import { createLogger } from '../utils/logger';

/**
 * Repository class for machine data access operations
 */
export class MachineRepository {
  private db: DatabaseConnection | null = null;
  private logger = createLogger('MachineRepository');

  constructor(db?: DatabaseConnection) {
    this.db = db || null;
  }

  /**
   * Get database connection (lazy initialization)
   */
  private async getDb(): Promise<DatabaseConnection> {
    if (!this.db) {
      try {
        this.db = await getDatabase();
        this.logger.debug('Database connection established');
      } catch (error) {
        this.logger.error('Failed to establish database connection', error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }
    return this.db;
  }

  /**
   * Find all machines
   */
  async findAll(): Promise<Machine[]> {
    const db = await this.getDb();
    const rows = await db.all<MachineRow>('SELECT * FROM machines ORDER BY name');
    return rows.map(row => Machine.fromRow(row));
  }

  /**
   * Find machine by ID
   */
  async findById(id: number): Promise<Machine | null> {
    const db = await this.getDb();
    const row = await db.get<MachineRow>('SELECT * FROM machines WHERE id = ?', [id]);
    return row ? Machine.fromRow(row) : null;
  }

  /**
   * Find machine by name
   */
  async findByName(name: string): Promise<Machine | null> {
    const db = await this.getDb();
    const row = await db.get<MachineRow>('SELECT * FROM machines WHERE name = ?', [name]);
    return row ? Machine.fromRow(row) : null;
  }

  /**
   * Find all machines with active timers
   */
  async findWithActiveTimers(): Promise<Machine[]> {
    const db = await this.getDb();
    const rows = await db.all<MachineRow>(
      'SELECT * FROM machines WHERE status = ? AND timer_end_time IS NOT NULL ORDER BY timer_end_time',
      ['in-use']
    );
    return rows.map(row => Machine.fromRow(row));
  }

  /**
   * Find machines with expired timers
   */
  async findWithExpiredTimers(): Promise<Machine[]> {
    const db = await this.getDb();
    const now = Math.floor(Date.now() / 1000);
    const rows = await db.all<MachineRow>(
      'SELECT * FROM machines WHERE status = ? AND timer_end_time IS NOT NULL AND timer_end_time <= ?',
      ['in-use', now]
    );
    return rows.map(row => Machine.fromRow(row));
  }

  /**
   * Create a new machine
   */
  async create(machine: Omit<MachineInterface, 'id'>): Promise<Machine> {
    const db = await this.getDb();
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.run(
      `INSERT INTO machines (name, status, timer_end_time, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        machine.name,
        machine.status,
        machine.timerEndTime || null,
        machine.createdAt || now,
        machine.updatedAt || now
      ]
    );

    if (!result.lastID) {
      throw new Error('Failed to create machine');
    }

    const created = await this.findById(result.lastID);
    if (!created) {
      throw new Error('Failed to retrieve created machine');
    }

    return created;
  }

  /**
   * Update an existing machine
   */
  async update(machine: Machine): Promise<Machine> {
    const db = await this.getDb();
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.run(
      `UPDATE machines 
       SET name = ?, status = ?, timer_end_time = ?, updated_at = ?
       WHERE id = ?`,
      [
        machine.name,
        machine.status,
        machine.timerEndTime || null,
        now,
        machine.id
      ]
    );

    if (result.changes === 0) {
      throw new Error(`Machine with id ${machine.id} not found`);
    }

    const updated = await this.findById(machine.id);
    if (!updated) {
      throw new Error('Failed to retrieve updated machine');
    }

    return updated;
  }

  /**
   * Delete a machine by ID
   */
  async delete(id: number): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.run('DELETE FROM machines WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Set timer for a machine
   */
  async setTimer(machineId: number, durationMinutes: number): Promise<Machine> {
    const machine = await this.findById(machineId);
    if (!machine) {
      throw new Error(`Machine with id ${machineId} not found`);
    }

    machine.setTimer(durationMinutes);
    return await this.update(machine);
  }

  /**
   * Clear timer for a machine (make it available)
   */
  async clearTimer(machineId: number): Promise<Machine> {
    const machine = await this.findById(machineId);
    if (!machine) {
      throw new Error(`Machine with id ${machineId} not found`);
    }

    machine.clearTimer();
    return await this.update(machine);
  }

  /**
   * Update machine status
   */
  async updateStatus(machineId: number, status: 'available' | 'in-use', timerEndTime?: number): Promise<Machine> {
    const db = await this.getDb();
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.run(
      `UPDATE machines 
       SET status = ?, timer_end_time = ?, updated_at = ?
       WHERE id = ?`,
      [status, timerEndTime || null, now, machineId]
    );

    if (result.changes === 0) {
      throw new Error(`Machine with id ${machineId} not found`);
    }

    const updated = await this.findById(machineId);
    if (!updated) {
      throw new Error('Failed to retrieve updated machine');
    }

    return updated;
  }

  /**
   * Bulk update expired timers to available status
   */
  async clearExpiredTimers(): Promise<number> {
    const db = await this.getDb();
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.run(
      `UPDATE machines 
       SET status = 'available', timer_end_time = NULL, updated_at = ?
       WHERE status = 'in-use' AND timer_end_time IS NOT NULL AND timer_end_time <= ?`,
      [now, now]
    );

    return result.changes || 0;
  }

  /**
   * Get count of machines by status
   */
  async getCountByStatus(): Promise<{ available: number; inUse: number }> {
    const db = await this.getDb();
    const result = await db.get<{ available: number; in_use: number }>(
      `SELECT 
         SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
         SUM(CASE WHEN status = 'in-use' THEN 1 ELSE 0 END) as in_use
       FROM machines`
    );

    return {
      available: result?.available || 0,
      inUse: result?.in_use || 0
    };
  }

  /**
   * Check if machine exists by name
   */
  async existsByName(name: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM machines WHERE name = ?', [name]);
    return (result?.count || 0) > 0;
  }

  /**
   * Check if machine exists by ID
   */
  async existsById(id: number): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM machines WHERE id = ?', [id]);
    return (result?.count || 0) > 0;
  }
}