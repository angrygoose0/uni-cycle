/**
 * Core interfaces for the laundry machine timer system
 */

export interface Machine {
  id: number;
  name: string;
  timerEndTime?: number; // Unix timestamp
  createdAt: number;
  updatedAt: number;
}

export interface TimerRequest {
  machineId: number;
  durationMinutes: number;
}

export interface MachineStatus {
  id: number;
  name: string;
  status: 'available' | 'in-use';
  remainingTimeMs?: number;
}

// API Request/Response types
export interface SetTimerRequest {
  durationMinutes: number;
}

export interface SetTimerResponse {
  success: boolean;
  machine: MachineStatus;
  message?: string;
}

export interface GetMachinesResponse {
  machines: MachineStatus[];
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
}

// Database row type (matches SQLite schema)
export interface MachineRow {
  id: number;
  name: string;
  timer_end_time: number | null;
  created_at: number;
  updated_at: number;
}

// Real-time update types
export interface StatusUpdateEvent {
  type: 'machine_status_update' | 'timer_expired' | 'timer_set';
  machineId: number;
  machine: MachineStatus;
  timestamp: number;
}

export interface SSEClient {
  id: string;
  response: any; // Express Response object
  lastPing: number;
}

// Action log types
export interface ActionLog {
  id: number;
  machineId: number;
  machineName: string;
  actionType: 'set_timer' | 'clear_timer' | 'timer_expired';
  durationMinutes?: number;
  timestamp: number;
  createdAt: number;
}

export interface ActionLogRow {
  id: number;
  machine_id: number;
  machine_name: string;
  action_type: 'set_timer' | 'clear_timer' | 'timer_expired';
  duration_minutes: number | null;
  timestamp: number;
  created_at: number;
}