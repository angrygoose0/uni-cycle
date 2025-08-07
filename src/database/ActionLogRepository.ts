import { DatabaseConnection, getDatabase } from './connection';
import { ActionLog } from '../models/ActionLog';
import { ActionLogRow, ActionLog as ActionLogInterface } from '../types';
import { createLogger } from '../utils/logger';

/**
 * Repository class for action log data access operations
 */
export class ActionLogRepository {
  private db: DatabaseConnection | null = null;
  private logger = createLogger('ActionLogRepository');

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
   * Create a new action log entry
   */
  async create(actionLog: Omit<ActionLogInterface, 'id'>): Promise<ActionLog> {
    const db = await this.getDb();
    const now = Math.floor(Date.now() / 1000);
    
    const result = await db.run(
      `INSERT INTO action_logs (machine_id, machine_name, action_type, duration_minutes, timestamp, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actionLog.machineId,
        actionLog.machineName,
        actionLog.actionType,
        actionLog.durationMinutes || null,
        actionLog.timestamp || now,
        actionLog.createdAt || now
      ]
    );

    if (!result.lastInsertRowid) {
      throw new Error('Failed to create action log');
    }

    const created = await this.findById(result.lastInsertRowid);
    if (!created) {
      throw new Error('Failed to retrieve created action log');
    }

    return created;
  }

  /**
   * Find action log by ID
   */
  async findById(id: number): Promise<ActionLog | null> {
    const db = await this.getDb();
    const row = await db.get<ActionLogRow>('SELECT * FROM action_logs WHERE id = ?', [id]);
    return row ? ActionLog.fromRow(row) : null;
  }

  /**
   * Find all action logs with optional pagination
   */
  async findAll(limit?: number, offset?: number): Promise<ActionLog[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM action_logs ORDER BY timestamp DESC';
    const params: any[] = [];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
      
      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }
    }

    const rows = await db.all<ActionLogRow>(query, params);
    return rows.map(row => ActionLog.fromRow(row));
  }

  /**
   * Find action logs by machine ID
   */
  async findByMachineId(machineId: number, limit?: number): Promise<ActionLog[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM action_logs WHERE machine_id = ? ORDER BY timestamp DESC';
    const params: any[] = [machineId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await db.all<ActionLogRow>(query, params);
    return rows.map(row => ActionLog.fromRow(row));
  }

  /**
   * Find action logs by action type
   */
  async findByActionType(actionType: 'set_timer' | 'clear_timer' | 'timer_expired', limit?: number): Promise<ActionLog[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM action_logs WHERE action_type = ? ORDER BY timestamp DESC';
    const params: any[] = [actionType];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await db.all<ActionLogRow>(query, params);
    return rows.map(row => ActionLog.fromRow(row));
  }

  /**
   * Find action logs within a time range
   */
  async findByTimeRange(startTimestamp: number, endTimestamp: number): Promise<ActionLog[]> {
    const db = await this.getDb();
    const rows = await db.all<ActionLogRow>(
      'SELECT * FROM action_logs WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
      [startTimestamp, endTimestamp]
    );
    return rows.map(row => ActionLog.fromRow(row));
  }

  /**
   * Get action log statistics
   */
  async getStats(): Promise<{
    total: number;
    setTimerCount: number;
    clearTimerCount: number;
    expiredTimerCount: number;
    todayCount: number;
  }> {
    const db = await this.getDb();
    
    // Get total count
    const totalResult = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM action_logs');
    const total = totalResult?.count || 0;

    // Get counts by action type
    const actionTypeResult = await db.all<{ action_type: string; count: number }>(
      'SELECT action_type, COUNT(*) as count FROM action_logs GROUP BY action_type'
    );

    let setTimerCount = 0;
    let clearTimerCount = 0;
    let expiredTimerCount = 0;

    actionTypeResult.forEach(row => {
      switch (row.action_type) {
        case 'set_timer':
          setTimerCount = row.count;
          break;
        case 'clear_timer':
          clearTimerCount = row.count;
          break;
        case 'timer_expired':
          expiredTimerCount = row.count;
          break;
      }
    });

    // Get today's count (from midnight UTC)
    const todayStart = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000);
    const todayResult = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM action_logs WHERE timestamp >= ?',
      [todayStart]
    );
    const todayCount = todayResult?.count || 0;

    return {
      total,
      setTimerCount,
      clearTimerCount,
      expiredTimerCount,
      todayCount
    };
  }

  /**
   * Get recent action logs (last 24 hours by default)
   */
  async getRecentLogs(hoursBack: number = 24, limit: number = 100): Promise<ActionLog[]> {
    const db = await this.getDb();
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (hoursBack * 3600);
    
    const rows = await db.all<ActionLogRow>(
      'SELECT * FROM action_logs WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?',
      [cutoffTimestamp, limit]
    );
    
    return rows.map(row => ActionLog.fromRow(row));
  }

  /**
   * Delete old action logs (older than specified days)
   */
  async deleteOldLogs(daysOld: number): Promise<number> {
    const db = await this.getDb();
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (daysOld * 24 * 3600);
    
    const result = await db.run(
      'DELETE FROM action_logs WHERE timestamp < ?',
      [cutoffTimestamp]
    );
    
    return result.changes;
  }
}