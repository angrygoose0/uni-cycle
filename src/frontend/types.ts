/**
 * Frontend types for the laundry machine timer system
 */

export interface MachineStatus {
  id: number;
  name: string;
  status: 'available' | 'in-use';
  remainingTimeMs?: number;
}

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

export interface StatusUpdateEvent {
  type: 'machine_status_update' | 'timer_expired' | 'timer_set';
  machineId: number;
  machine: MachineStatus;
  timestamp: number;
}