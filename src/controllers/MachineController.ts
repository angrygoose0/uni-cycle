import { Request, Response } from 'express';
import { MachineService } from '../services/MachineService';
import { StatusBroadcastService } from '../services/StatusBroadcastService';
import { SetTimerRequest, GetMachinesResponse, SetTimerResponse, ApiErrorResponse } from '../types';
import { createLogger } from '../utils/logger';

/**
 * Controller for machine-related API endpoints
 */
export class MachineController {
  private machineService: MachineService;
  private statusBroadcastService: StatusBroadcastService;
  private logger = createLogger('MachineController');

  constructor(machineService?: MachineService, statusBroadcastService?: StatusBroadcastService) {
    this.machineService = machineService || new MachineService();
    this.statusBroadcastService = statusBroadcastService || new StatusBroadcastService();
  }

  /**
   * GET /api/machines - Get all machines with their current status
   */
  async getAllMachines(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Getting all machines');
      const machines = await this.machineService.getAllMachines();
      
      const response: GetMachinesResponse = {
        machines
      };

      this.logger.info('Successfully retrieved machines', { count: machines.length });
      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Failed to get all machines', error instanceof Error ? error : new Error(String(error)));
      
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve machines'
      };

      res.status(500).json(errorResponse);
    }
  }

  /**
   * POST /api/machines/:id/timer - Set timer for a specific machine
   */
  async setTimer(req: Request, res: Response): Promise<void> {
    try {
      // Parse and validate machine ID
      const machineId = parseInt(req.params.id, 10);
      if (isNaN(machineId) || machineId <= 0) {
        this.logger.warn('Invalid machine ID provided', { machineId: req.params.id });
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'INVALID_MACHINE_ID',
          message: 'Machine ID must be a positive integer'
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Validate request body
      const { durationMinutes }: SetTimerRequest = req.body;
      
      if (typeof durationMinutes !== 'number') {
        this.logger.warn('Invalid duration type provided', { durationMinutes, type: typeof durationMinutes });
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'INVALID_DURATION',
          message: 'Duration must be a number'
        };
        res.status(400).json(errorResponse);
        return;
      }

      if (!Number.isInteger(durationMinutes)) {
        this.logger.warn('Non-integer duration provided', { durationMinutes });
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'INVALID_DURATION',
          message: 'Duration must be an integer'
        };
        res.status(400).json(errorResponse);
        return;
      }

      if (durationMinutes < 1 || durationMinutes > 120) {
        this.logger.warn('Duration out of valid range', { durationMinutes, validRange: '1-120' });
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'INVALID_DURATION',
          message: 'Duration must be between 1 and 120 minutes'
        };
        res.status(400).json(errorResponse);
        return;
      }

      this.logger.info('Setting timer for machine', { machineId, durationMinutes });

      // Set the timer
      const updatedMachine = await this.machineService.setTimer(machineId, durationMinutes);
      
      // Broadcast timer set event
      this.statusBroadcastService.broadcastTimerSet(machineId, updatedMachine);
      
      const response: SetTimerResponse = {
        success: true,
        machine: updatedMachine,
        message: `Timer set for ${durationMinutes} minutes`
      };

      this.logger.info('Timer set successfully', { machineId, durationMinutes, machineName: updatedMachine.name });
      res.status(200).json(response);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to set timer', errorObj, { machineId: req.params.id, body: req.body });
      
      const errorMessage = errorObj.message;
      
      // Handle specific error cases
      if (errorMessage.includes('not found')) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'MACHINE_NOT_FOUND',
          message: errorMessage
        };
        res.status(404).json(errorResponse);
        return;
      }

      if (errorMessage.includes('currently in use')) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'MACHINE_IN_USE',
          message: errorMessage
        };
        res.status(409).json(errorResponse);
        return;
      }

      if (errorMessage.includes('Invalid timer duration')) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'INVALID_DURATION',
          message: errorMessage
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Generic server error
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to set timer'
      };

      res.status(500).json(errorResponse);
    }
  }

  /**
   * GET /api/machines/status - Server-Sent Events endpoint for real-time updates
   */
  async getStatusUpdates(req: Request, res: Response): Promise<void> {
    try {
      // Generate unique client ID
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.logger.info('Setting up SSE connection', { clientId });
      
      // Add client to broadcast service
      this.statusBroadcastService.addClient(clientId, res);
      
      // Send initial machine status
      const machines = await this.machineService.getAllMachines();
      const initialData = {
        type: 'initial_status',
        data: {
          machines,
          timestamp: Date.now()
        }
      };
      
      res.write(`data: ${JSON.stringify(initialData)}\n\n`);
      this.logger.info('SSE connection established and initial data sent', { clientId, machineCount: machines.length });
      
    } catch (error) {
      this.logger.error('Failed to set up SSE connection', error instanceof Error ? error : new Error(String(error)));
      res.status(500).end();
    }
  }

  /**
   * GET /api/machines/status/polling - Fallback polling endpoint for clients that don't support SSE
   */
  async getStatusPolling(req: Request, res: Response): Promise<void> {
    try {
      this.logger.debug('Polling request for machine status');
      const machines = await this.machineService.getAllMachines();
      
      const response = {
        machines,
        timestamp: Date.now(),
        clientCount: this.statusBroadcastService.getClientCount()
      };

      this.logger.debug('Polling response sent', { machineCount: machines.length, clientCount: response.clientCount });
      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Failed to get status for polling', error instanceof Error ? error : new Error(String(error)));
      
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve machine status'
      };

      res.status(500).json(errorResponse);
    }
  }

  /**
   * GET /api/machines/:id/logs - Get action logs for a specific machine
   */
  async getMachineActionLogs(req: Request, res: Response): Promise<void> {
    try {
      // Parse and validate machine ID
      const machineId = parseInt(req.params.id, 10);
      if (isNaN(machineId) || machineId <= 0) {
        this.logger.warn('Invalid machine ID provided for logs', { machineId: req.params.id });
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'INVALID_MACHINE_ID',
          message: 'Machine ID must be a positive integer'
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Parse optional limit parameter
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      if (isNaN(limit) || limit <= 0 || limit > 1000) {
        this.logger.warn('Invalid limit parameter for logs', { limit: req.query.limit });
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'INVALID_LIMIT',
          message: 'Limit must be a positive integer between 1 and 1000'
        };
        res.status(400).json(errorResponse);
        return;
      }

      this.logger.info('Getting action logs for machine', { machineId, limit });
      const logs = await this.machineService.getMachineActionLogs(machineId, limit);
      
      res.status(200).json({
        success: true,
        machineId,
        logs,
        count: logs.length
      });
    } catch (error) {
      this.logger.error('Failed to get machine action logs', error instanceof Error ? error : new Error(String(error)));
      
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve action logs'
      };

      res.status(500).json(errorResponse);
    }
  }

  /**
   * GET /api/logs - Get recent action logs across all machines
   */
  async getRecentActionLogs(req: Request, res: Response): Promise<void> {
    try {
      // Parse optional limit parameter
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      if (isNaN(limit) || limit <= 0 || limit > 1000) {
        this.logger.warn('Invalid limit parameter for recent logs', { limit: req.query.limit });
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'INVALID_LIMIT',
          message: 'Limit must be a positive integer between 1 and 1000'
        };
        res.status(400).json(errorResponse);
        return;
      }

      this.logger.info('Getting recent action logs', { limit });
      const logs = await this.machineService.getRecentActionLogs(limit);
      
      res.status(200).json({
        success: true,
        logs,
        count: logs.length
      });
    } catch (error) {
      this.logger.error('Failed to get recent action logs', error instanceof Error ? error : new Error(String(error)));
      
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve recent action logs'
      };

      res.status(500).json(errorResponse);
    }
  }

  /**
   * GET /api/logs/stats - Get action log statistics
   */
  async getActionLogStats(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Getting action log statistics');
      const stats = await this.machineService.getActionLogStats();
      
      res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      this.logger.error('Failed to get action log statistics', error instanceof Error ? error : new Error(String(error)));
      
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve action log statistics'
      };

      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get broadcast service statistics
   */
  getBroadcastStats(): {
    connectedClients: number;
    clientIds: string[];
    pingIntervalActive: boolean;
  } {
    return this.statusBroadcastService.getStats();
  }
}