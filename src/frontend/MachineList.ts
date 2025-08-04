import { MachineStatus, GetMachinesResponse } from './types.js';

/**
 * MachineList component handles displaying machines and their status
 * Implements real-time status updates using polling with smooth countdown timers
 */
export class MachineList {
  private container: HTMLElement;
  private errorContainer: HTMLElement;
  private machines: MachineStatus[] = [];
  private previousMachines: MachineStatus[] = [];
  private updateInterval: number | null = null;
  private countdownInterval: number | null = null;
  private lastFetchTime: number = 0;

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
      this.startCountdownTimer();
      this.render();
      this.checkForConfetti();
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
      
      // Store previous state before updating
      this.previousMachines = [...this.machines];
      this.machines = data.machines;
      this.lastFetchTime = Date.now(); // Track when we fetched the data
      
      // Check for machines that became available and show confetti
      this.checkForNewlyAvailableMachines();
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
   * Set up real-time updates using polling
   */
  private setupRealTimeUpdates(): void {
    this.setupPolling();
  }

  /**
   * Set up polling as fallback for real-time updates
   */
  private setupPolling(): void {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Poll every 3 seconds for responsive updates
    this.updateInterval = window.setInterval(async () => {
      try {
        await this.loadMachines();
        this.hideError(); // Hide any previous errors if polling succeeds
        this.renderWithScrollPreservation();
      } catch (error) {
        console.error('Error during polling update:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update machine status';
        this.showError(`Connection lost: ${errorMessage}`);
      }
    }, 3000);
  }

  /**
   * Start the smooth countdown timer that updates every second
   */
  private startCountdownTimer(): void {
    // Clear any existing countdown interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // Update countdown every second for smooth display
    this.countdownInterval = window.setInterval(() => {
      this.updateCountdowns();
    }, 1000);
  }

  /**
   * Update countdown displays without re-rendering the entire list
   */
  private updateCountdowns(): void {
    const timerElements = this.container.querySelectorAll('.timer-remaining');
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    
    timerElements.forEach((element) => {
      // Get the machine ID from the parent card
      const machineCard = element.closest('.machine-card');
      if (!machineCard) return;
      
      // Find the corresponding machine by matching the card content
      const machineNameElement = machineCard.querySelector('.machine-name');
      if (!machineNameElement) return;
      
      const machineName = machineNameElement.textContent;
      const machine = this.machines.find(m => m.name === machineName && m.status === 'in-use' && m.remainingTimeMs);
      
      if (machine && machine.remainingTimeMs) {
        // Calculate current remaining time based on when we last fetched the data
        const currentRemainingTime = Math.max(0, machine.remainingTimeMs - timeSinceLastFetch);
        
        element.textContent = this.formatRemainingTime(currentRemainingTime);
        
        // If timer expired, trigger a refresh to update the status
        if (currentRemainingTime <= 0) {
          this.loadMachines().then(() => this.render()).catch(console.error);
        }
      }
    });
  }



  /**
   * Format remaining time as countdown (MM:SS)
   */
  private formatRemainingTime(remainingTimeMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(remainingTimeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // Format as MM:SS with leading zeros
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
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

    // Cards are not clickable - only accessible via direct links (QR codes)
    return `
      <div class="${cardClass}">
        <div class="machine-name">${machine.name}</div>
        <div class="machine-status ${statusClass}">${statusText}</div>
        ${timerDisplay}
      </div>
    `;
  }

  /**
   * Render the machine list grouped by type
   */
  private render(): void {
    if (this.machines.length === 0) {
      this.container.innerHTML = '<div class="loading">No machines available</div>';
      return;
    }

    // Group machines by type
    const washers = this.machines.filter(machine => machine.id >= 1 && machine.id <= 13);
    const dryers = this.machines.filter(machine => machine.id >= 14 && machine.id <= 27);

    // Count available machines
    const availableWashers = washers.filter(machine => machine.status === 'available').length;
    const availableDryers = dryers.filter(machine => machine.status === 'available').length;

    const washerCards = washers
      .map(machine => this.createMachineCard(machine))
      .join('');

    const dryerCards = dryers
      .map(machine => this.createMachineCard(machine))
      .join('');

    this.container.innerHTML = `
      <div class="machine-sections-container">
        <div class="machine-section left-section">
          <h2 class="section-title">
            Washers 
            <span class="available-count">${availableWashers} available</span>
          </h2>
          <div class="machine-scroll-container">
            <div class="machine-group washers">
              ${washerCards || '<div class="no-machines">No washers available</div>'}
            </div>
          </div>
        </div>
        
        <div class="machine-section right-section">
          <h2 class="section-title">
            Dryers 
            <span class="available-count">${availableDryers} available</span>
          </h2>
          <div class="machine-scroll-container">
            <div class="machine-group dryers">
              ${dryerCards || '<div class="no-machines">No dryers available</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render with scroll position preservation for polling updates
   */
  private renderWithScrollPreservation(): void {
    if (this.machines.length === 0) {
      this.container.innerHTML = '<div class="loading">No machines available</div>';
      return;
    }

    // Store current scroll positions
    const washerScrollContainer = this.container.querySelector('.left-section .machine-scroll-container') as HTMLElement;
    const dryerScrollContainer = this.container.querySelector('.right-section .machine-scroll-container') as HTMLElement;
    
    const washerScrollTop = washerScrollContainer?.scrollTop || 0;
    const dryerScrollTop = dryerScrollContainer?.scrollTop || 0;

    // Group machines by type
    const washers = this.machines.filter(machine => machine.id >= 1 && machine.id <= 13);
    const dryers = this.machines.filter(machine => machine.id >= 14 && machine.id <= 27);

    // Count available machines
    const availableWashers = washers.filter(machine => machine.status === 'available').length;
    const availableDryers = dryers.filter(machine => machine.status === 'available').length;

    // Update available counts without full re-render
    const washerCountElement = this.container.querySelector('.left-section .available-count');
    const dryerCountElement = this.container.querySelector('.right-section .available-count');
    
    if (washerCountElement) {
      washerCountElement.textContent = `${availableWashers} available`;
    }
    if (dryerCountElement) {
      dryerCountElement.textContent = `${availableDryers} available`;
    }

    // Update machine cards content
    const washerGroup = this.container.querySelector('.machine-group.washers');
    const dryerGroup = this.container.querySelector('.machine-group.dryers');

    if (washerGroup) {
      const washerCards = washers.map(machine => this.createMachineCard(machine)).join('');
      washerGroup.innerHTML = washerCards || '<div class="no-machines">No washers available</div>';
    }

    if (dryerGroup) {
      const dryerCards = dryers.map(machine => this.createMachineCard(machine)).join('');
      dryerGroup.innerHTML = dryerCards || '<div class="no-machines">No dryers available</div>';
    }

    // Restore scroll positions
    setTimeout(() => {
      const newWasherScrollContainer = this.container.querySelector('.left-section .machine-scroll-container') as HTMLElement;
      const newDryerScrollContainer = this.container.querySelector('.right-section .machine-scroll-container') as HTMLElement;
      
      if (newWasherScrollContainer) {
        newWasherScrollContainer.scrollTop = washerScrollTop;
      }
      if (newDryerScrollContainer) {
        newDryerScrollContainer.scrollTop = dryerScrollTop;
      }
    }, 0);
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
   * Check for confetti parameter in URL and show confetti for specific machine
   */
  private checkForConfetti(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const confettiMachineId = urlParams.get('confetti');
    
    if (confettiMachineId) {
      const machineId = parseInt(confettiMachineId);
      if (!isNaN(machineId)) {
        // Wait a bit for the DOM to be ready, then scroll to machine and show confetti
        setTimeout(() => {
          this.scrollToMachine(machineId);
          this.showConfettiForMachine(machineId);
        }, 100);
      }
      
      // Clean up URL by removing the confetti parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('confetti');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }

  /**
   * Check for machines that became available and show confetti
   */
  private checkForNewlyAvailableMachines(): void {
    if (this.previousMachines.length === 0) {
      // First load, no previous state to compare
      return;
    }

    // Find machines that changed from 'in-use' to 'available'
    this.machines.forEach(currentMachine => {
      if (currentMachine.status === 'available') {
        const previousMachine = this.previousMachines.find(prev => prev.id === currentMachine.id);
        
        if (previousMachine && previousMachine.status === 'in-use') {
          // This machine became available! Show confetti after a short delay to ensure DOM is updated
          setTimeout(() => {
            this.showConfettiForMachine(currentMachine.id);
          }, 200);
        }
      }
    });
  }

  /**
   * Smoothly scroll to a specific machine in the correct container
   */
  private scrollToMachine(machineId: number): void {
    // Find the machine card element
    const machineCards = this.container.querySelectorAll('.machine-card');
    let targetCard: Element | null = null;
    
    machineCards.forEach((card) => {
      const machineNameElement = card.querySelector('.machine-name');
      if (machineNameElement) {
        const machineName = machineNameElement.textContent;
        const machine = this.machines.find(m => m.id === machineId && m.name === machineName);
        if (machine) {
          targetCard = card;
        }
      }
    });

    if (!targetCard) return;

    // Determine which scroll container this machine belongs to
    const isWasher = machineId >= 1 && machineId <= 13;
    const scrollContainerSelector = isWasher 
      ? '.left-section .machine-scroll-container' 
      : '.right-section .machine-scroll-container';
    
    const scrollContainer = this.container.querySelector(scrollContainerSelector) as HTMLElement;
    
    if (!scrollContainer) return;

    // Get the position of the target card relative to the scroll container
    const containerRect = scrollContainer.getBoundingClientRect();
    const cardRect = (targetCard as HTMLElement).getBoundingClientRect();
    
    // Calculate the scroll position to center the card in the container
    const cardRelativeTop = cardRect.top - containerRect.top + scrollContainer.scrollTop;
    const containerHeight = scrollContainer.clientHeight;
    const cardHeight = cardRect.height;
    
    // Center the card in the container
    const targetScrollTop = cardRelativeTop - (containerHeight / 2) + (cardHeight / 2);
    
    // Ensure we don't scroll beyond the bounds
    const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const finalScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));

    // Smooth scroll to the target position
    scrollContainer.scrollTo({
      top: finalScrollTop,
      behavior: 'smooth'
    });
  }

  /**
   * Show confetti animation next to a specific machine card
   */
  private showConfettiForMachine(machineId: number): void {
    // Find the machine card element
    const machineCards = this.container.querySelectorAll('.machine-card');
    let targetCard: Element | null = null;
    
    machineCards.forEach((card) => {
      const machineNameElement = card.querySelector('.machine-name');
      if (machineNameElement) {
        const machineName = machineNameElement.textContent;
        const machine = this.machines.find(m => m.id === machineId && m.name === machineName);
        if (machine) {
          targetCard = card;
        }
      }
    });

    if (!targetCard) return;

    // Get the position of the target card
    const cardRect = (targetCard as HTMLElement).getBoundingClientRect();
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];
    const confettiCount = 25;

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      const startX = cardRect.left + cardRect.width / 2;
      const startY = cardRect.top + cardRect.height / 2;
      
      // Random direction and distance
      const angle = (Math.random() * 360) * (Math.PI / 180);
      const distance = 50 + Math.random() * 100;
      const endX = Math.cos(angle) * distance;
      const endY = Math.sin(angle) * distance;
      
      confetti.style.cssText = `
        position: fixed;
        width: 8px;
        height: 8px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${startX}px;
        top: ${startY}px;
        z-index: 9999;
        pointer-events: none;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        transform-origin: center;
      `;

      document.body.appendChild(confetti);

      // Animate the confetti and remove when animation completes
      const animationDuration = 800 + Math.random() * 400;
      const animation = confetti.animate([
        {
          transform: 'translate(0, 0) rotate(0deg) scale(1)',
          opacity: 1
        },
        {
          transform: `translate(${endX}px, ${endY}px) rotate(${360 + Math.random() * 360}deg) scale(0)`,
          opacity: 0
        }
      ], {
        duration: animationDuration,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards'
      });

      // Remove confetti when animation finishes
      animation.addEventListener('finish', () => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti);
        }
      });

      // Fallback cleanup in case animation event doesn't fire
      setTimeout(() => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti);
        }
      }, animationDuration + 100);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}