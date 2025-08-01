import { Response } from 'express';
import { StatusUpdateEvent, SSEClient, MachineStatus } from '../types';

/**
 * Service for managing real-time status updates via Server-Sent Events
 */
export class StatusBroadcastService {
  private clients: Map<string, SSEClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL_MS = 30000; // 30 seconds
  private readonly CLIENT_TIMEOUT_MS = 60000; // 60 seconds

  constructor(enablePing: boolean = true) {
    if (enablePing) {
      this.startPingInterval();
    }
  }

  /**
   * Add a new SSE client
   */
  addClient(clientId: string, response: Response): void {
    // Set up SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    this.sendToClient(response, {
      type: 'connection',
      data: { clientId, timestamp: Date.now() }
    });

    // Store client
    const client: SSEClient = {
      id: clientId,
      response,
      lastPing: Date.now()
    };

    this.clients.set(clientId, client);

    // Handle client disconnect
    response.on('close', () => {
      this.removeClient(clientId);
    });

    response.on('error', (error) => {
      console.error(`SSE client ${clientId} error:`, error);
      this.removeClient(clientId);
    });

    console.log(`SSE client ${clientId} connected. Total clients: ${this.clients.size}`);
  }

  /**
   * Remove a client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        // Client may already be disconnected
      }
      this.clients.delete(clientId);
      console.log(`SSE client ${clientId} disconnected. Total clients: ${this.clients.size}`);
    }
  }

  /**
   * Broadcast a status update to all connected clients
   */
  broadcastStatusUpdate(event: StatusUpdateEvent): void {
    const message = {
      type: 'status_update',
      data: event
    };

    this.broadcastToAllClients(message);
    console.log(`Broadcasted ${event.type} for machine ${event.machineId} to ${this.clients.size} clients`);
  }

  /**
   * Broadcast machine timer expiration
   */
  broadcastTimerExpired(machineId: number, machine: MachineStatus): void {
    const event: StatusUpdateEvent = {
      type: 'timer_expired',
      machineId,
      machine,
      timestamp: Date.now()
    };

    this.broadcastStatusUpdate(event);
  }

  /**
   * Broadcast timer set event
   */
  broadcastTimerSet(machineId: number, machine: MachineStatus): void {
    const event: StatusUpdateEvent = {
      type: 'timer_set',
      machineId,
      machine,
      timestamp: Date.now()
    };

    this.broadcastStatusUpdate(event);
  }

  /**
   * Broadcast general machine status update
   */
  broadcastMachineStatusUpdate(machineId: number, machine: MachineStatus): void {
    const event: StatusUpdateEvent = {
      type: 'machine_status_update',
      machineId,
      machine,
      timestamp: Date.now()
    };

    this.broadcastStatusUpdate(event);
  }

  /**
   * Get current client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Send message to all clients
   */
  private broadcastToAllClients(message: any): void {
    const clientsToRemove: string[] = [];

    for (const [clientId, client] of this.clients) {
      try {
        this.sendToClient(client.response, message);
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        clientsToRemove.push(clientId);
      }
    }

    // Remove failed clients
    clientsToRemove.forEach(clientId => this.removeClient(clientId));
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(response: Response, message: any): void {
    const data = JSON.stringify(message);
    response.write(`data: ${data}\n\n`);
  }

  /**
   * Send ping to all clients to keep connections alive
   */
  private sendPing(): void {
    const pingMessage = {
      type: 'ping',
      data: { timestamp: Date.now() }
    };

    const clientsToRemove: string[] = [];
    const now = Date.now();

    for (const [clientId, client] of this.clients) {
      // Check if client has timed out
      if (now - client.lastPing > this.CLIENT_TIMEOUT_MS) {
        clientsToRemove.push(clientId);
        continue;
      }

      try {
        this.sendToClient(client.response, pingMessage);
        client.lastPing = now;
      } catch (error) {
        console.error(`Failed to ping client ${clientId}:`, error);
        clientsToRemove.push(clientId);
      }
    }

    // Remove timed out or failed clients
    clientsToRemove.forEach(clientId => this.removeClient(clientId));
  }

  /**
   * Start the ping interval to keep connections alive
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.clients.size > 0) {
        this.sendPing();
      }
    }, this.PING_INTERVAL_MS);
  }

  /**
   * Stop the ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Cleanup method to close all connections and stop intervals
   */
  cleanup(): void {
    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        client.response.end();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    this.clients.clear();
    this.stopPingInterval();
    console.log('StatusBroadcastService cleaned up');
  }

  /**
   * Get service statistics
   */
  getStats(): {
    connectedClients: number;
    clientIds: string[];
    pingIntervalActive: boolean;
  } {
    return {
      connectedClients: this.clients.size,
      clientIds: this.getClientIds(),
      pingIntervalActive: this.pingInterval !== null
    };
  }
}