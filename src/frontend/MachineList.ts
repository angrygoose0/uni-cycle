import { MachineStatus, GetMachinesResponse, StatusUpdateEvent } from './types.js';

/**
 * MachineList component handles displaying machines and their status
 * Implements real-time status updates using Server-Sent Events
 */
export class MachineList {
  private container: HTMLElement;
  private errorContainer: HTMLElement;
  private eventSource: EventSource | null = null;
  private machines: MachineStatus[] = [];
  private updateInterval: number | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id '${containerId}' not found`);
    }
    this.container = container;

    const errorContainer = document.getElementById('error-container');
    if (!errorContainer) {
      throw new Error(`Error container with id 'error-container' not found`);
    }
    this.errorContainer = errorContainer;
  }

  /**
   * Initialize the machine list component
   */
  async init(): Promise<void> {
    try {
      this.hideError();
      await this.loadMachines();
      this.setupRealTimeUpdates();
      this.render();
    } catch (error) {
      console.error('Failed to initialize machine list:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load machines. Please refresh the page.';
      this.showError(errorMessage);
    }
  }

  /**
   * Load machines from the API
   */
  private async loadMachines(): Promise<void> {
    try {
      const response = await fetch('/api/machines');
      
      if (!response.ok) {
        let errorMessage = `Failed to load machines (HTTP ${response.status})`;
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If we can't parse the error response, use the default message
        }
        
        throw new Error(errorMessage);
      }
      
      const data: GetMachinesResponse = await response.json();
      
      if (!data.machines || !Array.isArray(data.machines)) {
        throw new Error('Invalid response format from server');
      }
      
      this.machines = data.machines;
    } catch (error) {
      console.error('Error loading machines:', error);
      
      // Provide more specific error messages based on error type
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  /**
   * Set up real-time updates using Server-Sent Events with fallback to polling
   */
  private setupRealTimeUpdates(): void {
    // Try to establish SSE connection
    try {
      this.eventSource = new EventSource('/api/machines/status');
      
      this.eventSource.onmessage = (event) => {
        try {
          const updateEvent: StatusUpdateEvent = JSON.parse(event.data);
          this.handleStatusUpdate(updateEvent);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.warn('SSE connection error, falling back to polling:', error);
        this.eventSource?.close();
        this.eventSource = null;
        this.setupPolling();
      };

      this.eventSource.onopen = () => {
        console.log('SSE connection established');
      };
    } catch (error) {
      console.warn('SSE not supported, using polling:', error);
      this.setupPolling();
    }
  }

  /**
   * Set up polling as fallback for real-time updates
   */
  private setupPolling(): void {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Poll every 10 seconds
    this.updateInterval = window.setInterval(async () => {
      try {
        await this.loadMachines();
        this.hideError(); // Hide any previous errors if polling succeeds
        this.render();
      } catch (error) {
        console.error('Error during polling update:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update machine status';
        this.showError(`Connection lost: ${errorMessage}`);
      }
    }, 10000);
  }

  /**
   * Handle status update from SSE
   */
  private handleStatusUpdate(updateEvent: StatusUpdateEvent): void {
    const machineIndex = this.machines.findIndex(m => m.id === updateEvent.machineId);
    if (machineIndex !== -1) {
      this.machines[machineIndex] = updateEvent.machine;
      this.render();
    }
  }

  /**
   * Format remaining time for display
   */
  private formatRemainingTime(remainingTimeMs: number): string {
    const totalMinutes = Math.ceil(remainingTimeMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }

  /**
   * Create HTML for a single machine card
   */
  private createMachineCard(machine: MachineStatus): string {
    const isAvailable = machine.status === 'available';
    const cardClass = isAvailable ? 'machine-card available' : 'machine-card in-use';
    const statusClass = isAvailable ? 'status-available' : 'status-in-use';
    const statusText = isAvailable ? 'Available' : 'In Use';
    
    let timerDisplay = '';
    if (machine.status === 'in-use' && machine.remainingTimeMs) {
      timerDisplay = `<div class="timer-remaining">${this.formatRemainingTime(machine.remainingTimeMs)}</div>`;
    }

    const clickHandler = isAvailable ? `onclick="window.location.href='timer-setup.html?machineId=${machine.id}'"` : '';

    return `
      <div class="${cardClass}" ${clickHandler}>
        <div class="machine-name">${machine.name}</div>
        <div class="machine-status ${statusClass}">${statusText}</div>
        ${timerDisplay}
      </div>
    `;
  }

  /**
   * Render the machine list
   */
  private render(): void {
    if (this.machines.length === 0) {
      this.container.innerHTML = '<div class="loading">No machines available</div>';
      return;
    }

    const machineCards = this.machines
      .map(machine => this.createMachineCard(machine))
      .join('');

    this.container.innerHTML = machineCards;
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.errorContainer.innerHTML = `
      <strong>Error:</strong> ${message}
      <button class="btn btn-secondary" onclick="window.location.reload()" style="margin-left: 10px;">
        Retry
      </button>
    `;
    this.errorContainer.style.display = 'block';
    
    // Hide the machine list when showing error
    this.container.innerHTML = '';
  }

  /**
   * Hide error message
   */
  private hideError(): void {
    this.errorContainer.style.display = 'none';
    this.errorContainer.innerHTML = '';
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}