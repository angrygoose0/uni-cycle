import { Machine, MachineData } from '../Machine';

describe('Frontend Machine', () => {
  const now = Math.floor(Date.now() / 1000);
  
  const validMachineData: MachineData = {
    id: 1,
    name: 'Washer 1',
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
      const machineData: MachineData = {
        ...validMachineData,
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

    it('should throw error for whitespace-only machine name', () => {
      expect(() => {
        new Machine({ ...validMachineData, name: '   ' });
      }).toThrow('Machine name is required');
    });

    it('should throw error for machine name too long', () => {
      expect(() => {
        new Machine({ ...validMachineData, name: 'a'.repeat(101) });
      }).toThrow('Machine name must be 100 characters or less');
    });

    it('should throw error for negative timer end time', () => {
      expect(() => {
        new Machine({ ...validMachineData, timerEndTime: -1 });
      }).toThrow('Timer end time must be a positive timestamp');
    });

    it('should throw error for zero timer end time', () => {
      expect(() => {
        new Machine({ ...validMachineData, timerEndTime: 0 });
      }).toThrow('Timer end time must be a positive timestamp');
    });

    it('should throw error for invalid created timestamp', () => {
      expect(() => {
        new Machine({ ...validMachineData, createdAt: 0 });
      }).toThrow('Created and updated timestamps must be positive');
    });

    it('should throw error for invalid updated timestamp', () => {
      expect(() => {
        new Machine({ ...validMachineData, updatedAt: 0 });
      }).toThrow('Created and updated timestamps must be positive');
    });

    it('should throw error when updated timestamp is before created timestamp', () => {
      expect(() => {
        new Machine({ 
          ...validMachineData, 
          createdAt: now,
          updatedAt: now - 100
        });
      }).toThrow('Updated timestamp cannot be before created timestamp');
    });
  });

  describe('status calculation', () => {
    it('should return available when no timer is set', () => {
      const machine = new Machine(validMachineData);
      expect(machine.status).toBe('available');
    });

    it('should return in-use when timer is active', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 1800 // 30 minutes from now
      });
      expect(machine.status).toBe('in-use');
    });

    it('should return available when timer has expired', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now - 60 // 1 minute ago
      });
      expect(machine.status).toBe('available');
    });
  });

  describe('fromData', () => {
    it('should create machine from localStorage data', () => {
      const data: MachineData = {
        id: 1,
        name: 'Washer 1',
        createdAt: now - 3600,
        updatedAt: now
      };

      const machine = Machine.fromData(data);
      expect(machine.id).toBe(1);
      expect(machine.name).toBe('Washer 1');
      expect(machine.status).toBe('available');
      expect(machine.timerEndTime).toBeUndefined();
    });

    it('should handle timer data from localStorage', () => {
      const data: MachineData = {
        id: 2,
        name: 'Dryer 1',
        timerEndTime: now + 1800,
        createdAt: now - 3600,
        updatedAt: now
      };

      const machine = Machine.fromData(data);
      expect(machine.status).toBe('in-use');
      expect(machine.timerEndTime).toBe(now + 1800);
    });
  });

  describe('toData', () => {
    it('should convert machine to localStorage data format', () => {
      const machine = new Machine(validMachineData);
      const data = machine.toData();

      expect(data.id).toBe(1);
      expect(data.name).toBe('Washer 1');
      expect(data.timerEndTime).toBeUndefined();
      expect(data.createdAt).toBe(now - 3600);
      expect(data.updatedAt).toBe(now);
    });

    it('should include timer data when present', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 1800
      });
      const data = machine.toData();

      expect(data.timerEndTime).toBe(now + 1800);
    });
  });

  describe('timer operations', () => {
    it('should set timer correctly', () => {
      const machine = new Machine(validMachineData);
      const beforeSet = Math.floor(Date.now() / 1000);
      
      machine.setTimer(30);

      expect(machine.status).toBe('in-use');
      expect(machine.timerEndTime).toBeGreaterThanOrEqual(beforeSet + 1800);
      expect(machine.timerEndTime).toBeLessThanOrEqual(beforeSet + 1800 + 1); // Allow 1 second tolerance
      expect(machine.updatedAt).toBeGreaterThanOrEqual(beforeSet);
    });

    it('should allow timer override on in-use machine', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 1800
      });

      const beforeSet = Math.floor(Date.now() / 1000);
      machine.setTimer(60); // Set 60 minute timer

      expect(machine.status).toBe('in-use');
      expect(machine.timerEndTime).toBeGreaterThanOrEqual(beforeSet + 3600);
      expect(machine.updatedAt).toBeGreaterThanOrEqual(beforeSet);
    });

    it('should clear timer correctly', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 1800
      });

      const beforeClear = Math.floor(Date.now() / 1000);
      machine.clearTimer();
      
      expect(machine.status).toBe('available');
      expect(machine.timerEndTime).toBeUndefined();
      expect(machine.updatedAt).toBeGreaterThanOrEqual(beforeClear);
    });

    it('should detect expired timer', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now - 60 // 1 minute ago
      });

      expect(machine.isTimerExpired()).toBe(true);
    });

    it('should detect active timer', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 1800 // 30 minutes from now
      });

      expect(machine.isTimerExpired()).toBe(false);
    });

    it('should return false for expired timer when no timer is set', () => {
      const machine = new Machine(validMachineData);
      expect(machine.isTimerExpired()).toBe(false);
    });

    it('should calculate remaining time correctly', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 1800 // 30 minutes from now
      });

      const remainingMs = machine.getRemainingTimeMs();
      expect(remainingMs).toBeGreaterThan(1790000); // ~29.8 minutes
      expect(remainingMs).toBeLessThanOrEqual(1800000); // 30 minutes
    });

    it('should return zero remaining time when no timer is set', () => {
      const machine = new Machine(validMachineData);
      expect(machine.getRemainingTimeMs()).toBe(0);
    });

    it('should return zero remaining time when timer has expired', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now - 60 // 1 minute ago
      });
      expect(machine.getRemainingTimeMs()).toBe(0);
    });

    it('should calculate remaining minutes correctly', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 1800 // 30 minutes from now
      });

      const remainingMinutes = machine.getRemainingMinutes();
      expect(remainingMinutes).toBe(30);
    });

    it('should round up remaining minutes', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 61 // 1 minute and 1 second from now
      });

      const remainingMinutes = machine.getRemainingMinutes();
      expect(remainingMinutes).toBe(2); // Should round up
    });
  });

  describe('validateTimerDuration', () => {
    it('should accept valid duration', () => {
      expect(() => Machine.validateTimerDuration(30)).not.toThrow();
      expect(() => Machine.validateTimerDuration(1)).not.toThrow();
      expect(() => Machine.validateTimerDuration(120)).not.toThrow();
    });

    it('should reject non-integer duration', () => {
      expect(() => Machine.validateTimerDuration(30.5)).toThrow('Timer duration must be an integer');
      expect(() => Machine.validateTimerDuration(1.1)).toThrow('Timer duration must be an integer');
    });

    it('should reject duration less than 1', () => {
      expect(() => Machine.validateTimerDuration(0)).toThrow('Timer duration must be at least 1 minute');
      expect(() => Machine.validateTimerDuration(-1)).toThrow('Timer duration must be at least 1 minute');
    });

    it('should reject duration greater than 120', () => {
      expect(() => Machine.validateTimerDuration(121)).toThrow('Timer duration cannot exceed 120 minutes (2 hours)');
      expect(() => Machine.validateTimerDuration(500)).toThrow('Timer duration cannot exceed 120 minutes (2 hours)');
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
        timerEndTime: now + 1800
      });
      
      const status = machine.toStatus();
      expect(status.status).toBe('in-use');
      expect(status.remainingTimeMs).toBeGreaterThan(0);
      expect(status.remainingTimeMs).toBeLessThanOrEqual(1800000);
    });

    it('should not include remaining time for expired timer', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now - 60 // 1 minute ago
      });
      
      const status = machine.toStatus();
      expect(status.status).toBe('available');
      expect(status.remainingTimeMs).toBeUndefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true for machine with no timer', () => {
      const machine = new Machine(validMachineData);
      expect(machine.isAvailable()).toBe(true);
    });

    it('should return false for machine with active timer', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now + 1800
      });
      expect(machine.isAvailable()).toBe(false);
    });

    it('should return true for machine with expired timer', () => {
      const machine = new Machine({
        ...validMachineData,
        timerEndTime: now - 60
      });
      expect(machine.isAvailable()).toBe(true);
    });
  });
});