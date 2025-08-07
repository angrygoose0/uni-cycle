import { Machine } from '../Machine';
import { MachineRow } from '../../types';

describe('Machine', () => {
  const now = Math.floor(Date.now() / 1000);
  
  const validMachineData = {
    id: 1,
    name: 'Washer 1',
    status: 'available' as const,
    createdAt: now - 3600,
    updatedAt: now
  };

  describe('constructor and validation', () => {
    it('should create a valid available machine', () => {
      const machine = new Machine(validMachineData);
      
      expect(machine.id).toBe(1);
      expect(machine.name).toBe('Washer 1');
      expect(machine.status).toBe('available');
      expect(machine.timerEndTime).toBeUndefined();
    });

    it('should create a valid in-use machine with timer', () => {
      const machineData = {
        ...validMachineData,
        status: 'in-use' as const,
        timerEndTime: now + 1800 // 30 minutes from now
      };
      
      const machine = new Machine(machineData);
      expect(machine.status).toBe('in-use');
      expect(machine.timerEndTime).toBe(now + 1800);
    });

    it('should throw error for empty machine name', () => {
      expect(() => {
        new Machine({ ...validMachineData, name: '' });
      }).toThrow('Machine name is required');
    });

    it('should throw error for machine name too long', () => {
      expect(() => {
        new Machine({ ...validMachineData, name: 'a'.repeat(101) });
      }).toThrow('Machine name must be 100 characters or less');
    });

    it('should throw error for invalid status', () => {
      expect(() => {
        new Machine({ ...validMachineData, status: 'invalid' as any });
      }).toThrow('Machine status must be either "available" or "in-use"');
    });

    it('should throw error for in-use machine without timer', () => {
      expect(() => {
        new Machine({ ...validMachineData, status: 'in-use' });
      }).toThrow('Timer end time is required when machine is in-use');
    });

    it('should throw error for available machine with timer', () => {
      expect(() => {
        new Machine({ ...validMachineData, timerEndTime: now + 1800 });
      }).toThrow('Timer end time should not be set when machine is available');
    });
  });

  describe('fromRow', () => {
    it('should create machine from database row', () => {
      const row: MachineRow = {
        id: 1,
        name: 'Washer 1',
        status: 'available',
        timer_end_time: null,
        created_at: now - 3600,
        updated_at: now
      };

      const machine = Machine.fromRow(row);
      expect(machine.id).toBe(1);
      expect(machine.name).toBe('Washer 1');
      expect(machine.status).toBe('available');
      expect(machine.timerEndTime).toBeUndefined();
    });

    it('should handle timer_end_time from database row', () => {
      const row: MachineRow = {
        id: 2,
        name: 'Dryer 1',
        status: 'in-use',
        timer_end_time: now + 1800,
        created_at: now - 3600,
        updated_at: now
      };

      const machine = Machine.fromRow(row);
      expect(machine.status).toBe('in-use');
      expect(machine.timerEndTime).toBe(now + 1800);
    });
  });

  describe('timer operations', () => {
    it('should set timer correctly', () => {
      const machine = new Machine(validMachineData);
      machine.setTimer(30);

      expect(machine.status).toBe('in-use');
      expect(machine.timerEndTime).toBeGreaterThan(now);
      expect(machine.timerEndTime).toBeLessThanOrEqual(now + 1800);
    });

    it('should throw error when setting timer on in-use machine', () => {
      const machine = new Machine({
        ...validMachineData,
        status: 'in-use',
        timerEndTime: now + 1800
      });

      expect(() => {
        machine.setTimer(30);
      }).toThrow('Cannot set timer on machine that is already in use');
    });

    it('should clear timer correctly', () => {
      const machine = new Machine({
        ...validMachineData,
        status: 'in-use',
        timerEndTime: now + 1800
      });

      machine.clearTimer();
      expect(machine.status).toBe('available');
      expect(machine.timerEndTime).toBeUndefined();
    });

    it('should detect expired timer', () => {
      const machine = new Machine({
        ...validMachineData,
        status: 'in-use',
        timerEndTime: now - 60 // 1 minute ago
      });

      expect(machine.isTimerExpired()).toBe(true);
    });

    it('should calculate remaining time correctly', () => {
      const machine = new Machine({
        ...validMachineData,
        status: 'in-use',
        timerEndTime: now + 1800 // 30 minutes from now
      });

      const remainingMs = machine.getRemainingTimeMs();
      expect(remainingMs).toBeGreaterThan(1790000); // ~29.8 minutes
      expect(remainingMs).toBeLessThanOrEqual(1800000); // 30 minutes
    });
  });

  describe('validateTimerDuration', () => {
    it('should accept valid duration', () => {
      expect(() => Machine.validateTimerDuration(30)).not.toThrow();
    });

    it('should reject non-integer duration', () => {
      expect(() => Machine.validateTimerDuration(30.5)).toThrow('Timer duration must be an integer');
    });

    it('should reject duration less than 1', () => {
      expect(() => Machine.validateTimerDuration(0)).toThrow('Timer duration must be at least 1 minute');
    });

    it('should reject duration greater than 120', () => {
      expect(() => Machine.validateTimerDuration(121)).toThrow('Timer duration cannot exceed 120 minutes');
    });
  });

  describe('toStatus', () => {
    it('should convert available machine to status', () => {
      const machine = new Machine(validMachineData);
      const status = machine.toStatus();

      expect(status.id).toBe(1);
      expect(status.name).toBe('Washer 1');
      expect(status.status).toBe('available');
      expect(status.remainingTimeMs).toBeUndefined();
    });

    it('should convert in-use machine to status with remaining time', () => {
      const machine = new Machine({
        ...validMachineData,
        status: 'in-use',
        timerEndTime: now + 1800
      });
      
      const status = machine.toStatus();
      expect(status.status).toBe('in-use');
      expect(status.remainingTimeMs).toBeGreaterThan(0);
    });
  });
});