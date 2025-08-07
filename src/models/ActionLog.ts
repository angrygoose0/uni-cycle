import { ActionLog as ActionLogInterface, ActionLogRow } from '../types';

/**
 * ActionLog entity class for tracking all timer actions
 */
export class ActionLog implements ActionLogInterface {
  public readonly id: number;
  public readonly machineId: number;
  public readonly machineName: string;
  public readonly actionType: 'set_timer' | 'clear_timer' | 'timer_expired';
  public readonly durationMinutes?: number;
  public readonly timestamp: number;
  public readonly createdAt: number;

  constructor(data: ActionLogInterface) {
    this.id = data.id;
    this.machineId = data.machineId;
    this.machineName = data.machineName;
    this.actionType = data.actionType;
    this.durationMinutes = data.durationMinutes;
    this.timestamp = data.timestamp;
    this.createdAt = data.createdAt;

    this.validate();
  }

  /**
   * Create ActionLog instance from database row
   */
  static fromRow(row: ActionLogRow): ActionLog {
    return new ActionLog({
      id: row.id,
      machineId: row.machine_id,
      machineName: row.machine_name,
      actionType: row.action_type,
      durationMinutes: row.duration_minutes || undefined,
      timestamp: row.timestamp,
      createdAt: row.created_at
    });
  }

  /**
   * Convert ActionLog instance to database row format
   */
  toRow(): Omit<ActionLogRow, 'id'> {
    return {
      machine_id: this.machineId,
      machine_name: this.machineName,
      action_type: this.actionType,
      duration_minutes: this.durationMinutes || null,
      timestamp: this.timestamp,
      created_at: this.createdAt
    };
  }

  /**
   * Validate action log data
   */
  private validate(): void {
    if (!this.machineName || this.machineName.trim().length === 0) {
      throw new Error('Machine name is required');
    }

    if (!['set_timer', 'clear_timer', 'timer_expired'].includes(this.actionType)) {
      throw new Error('Invalid action type');
    }

    if (this.actionType === 'set_timer' && (!this.durationMinutes || this.durationMinutes <= 0)) {
      throw new Error('Duration minutes is required for set_timer actions');
    }

    if (this.actionType !== 'set_timer' && this.durationMinutes !== undefined) {
      throw new Error('Duration minutes should only be set for set_timer actions');
    }

    if (this.timestamp <= 0 || this.createdAt <= 0) {
      throw new Error('Timestamp and created_at must be positive');
    }

    if (this.machineId <= 0) {
      throw new Error('Machine ID must be positive');
    }
  }

  /**
   * Get formatted timestamp as ISO string
   */
  getFormattedTimestamp(): string {
    return new Date(this.timestamp * 1000).toISOString();
  }

  /**
   * Get human-readable action description
   */
  getActionDescription(): string {
    switch (this.actionType) {
      case 'set_timer':
        return `Timer set for ${this.durationMinutes} minutes`;
      case 'clear_timer':
        return 'Timer cleared';
      case 'timer_expired':
        return 'Timer expired';
      default:
        return 'Unknown action';
    }
  }
}