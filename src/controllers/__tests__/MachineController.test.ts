import { Request, Response } from 'express';
import { MachineController } from '../MachineController';
import { MachineService } from '../../services/MachineService';
import { MachineStatus } from '../../types';

// Mock the MachineService
jest.mock('../../services/MachineService');

describe('MachineController', () => {
  let machineController: MachineController;
  let mockMachineService: jest.Mocked<MachineService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockMachineService = new MachineService() as jest.Mocked<MachineService>;
    machineController = new MachineController(mockMachineService);
    
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('getAllMachines', () => {
    it('should return all machines successfully', async () => {
      // Arrange
      const mockMachines: MachineStatus[] = [
        { id: 1, name: 'Washer 1', status: 'available' },
        { id: 2, name: 'Washer 2', status: 'in-use', remainingTimeMs: 1800000 }
      ];
      mockMachineService.getAllMachines.mockResolvedValue(mockMachines);

      // Act
      await machineController.getAllMachines(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockMachineService.getAllMachines).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        machines: mockMachines
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockMachineService.getAllMachines.mockRejectedValue(new Error('Database error'));

      // Act
      await machineController.getAllMachines(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve machines'
      });
    });
  });

  describe('setTimer', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: '1' },
        body: { durationMinutes: 30 }
      };
    });

    it('should set timer successfully', async () => {
      // Arrange
      const mockUpdatedMachine: MachineStatus = {
        id: 1,
        name: 'Washer 1',
        status: 'in-use',
        remainingTimeMs: 1800000
      };
      mockMachineService.setTimer.mockResolvedValue(mockUpdatedMachine);

      // Act
      await machineController.setTimer(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockMachineService.setTimer).toHaveBeenCalledWith(1, 30);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        machine: mockUpdatedMachine,
        message: 'Timer set for 30 minutes'
      });
    });

    it('should return 400 for invalid machine ID', async () => {
      // Arrange
      mockRequest.params = { id: 'invalid' };

      // Act
      await machineController.setTimer(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_MACHINE_ID',
        message: 'Machine ID must be a positive integer'
      });
    });

    it('should return 400 for invalid duration', async () => {
      // Arrange
      mockRequest.body = { durationMinutes: 'invalid' };

      // Act
      await machineController.setTimer(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_DURATION',
        message: 'Duration must be a number'
      });
    });

    it('should return 400 for duration out of range', async () => {
      // Arrange
      mockRequest.body = { durationMinutes: 500 };

      // Act
      await machineController.setTimer(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_DURATION',
        message: 'Duration must be between 1 and 120 minutes'
      });
    });

    it('should return 404 for machine not found', async () => {
      // Arrange
      mockMachineService.setTimer.mockRejectedValue(new Error('Machine with ID 1 not found'));

      // Act
      await machineController.setTimer(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'MACHINE_NOT_FOUND',
        message: 'Machine with ID 1 not found'
      });
    });

    it('should return 409 for machine in use', async () => {
      // Arrange
      mockMachineService.setTimer.mockRejectedValue(new Error('Machine Washer 1 is currently in use'));

      // Act
      await machineController.setTimer(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'MACHINE_IN_USE',
        message: 'Machine Washer 1 is currently in use'
      });
    });

    it('should return 500 for unexpected errors', async () => {
      // Arrange
      mockMachineService.setTimer.mockRejectedValue(new Error('Unexpected database error'));

      // Act
      await machineController.setTimer(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to set timer'
      });
    });
  });
});