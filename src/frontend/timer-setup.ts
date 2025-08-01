import { TimerSetup, getMachineIdFromUrl } from './TimerSetup.js';

/**
 * Main entry point for the timer setup page
 * Initializes the TimerSetup component
 */

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get machine ID from URL parameters
    const machineId = getMachineIdFromUrl();
    
    if (!machineId) {
      throw new Error('Machine ID not provided in URL');
    }

    // Initialize timer setup component
    const timerSetup = new TimerSetup(machineId);
    await timerSetup.init();
    
  } catch (error) {
    console.error('Failed to initialize timer setup:', error);
    
    // Show error message to user
    const container = document.querySelector('.timer-setup-form');
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <strong>Error:</strong> ${error instanceof Error ? error.message : 'Failed to load timer setup'}
          <br><br>
          <a href="index.html" class="btn btn-secondary">Back to Machine List</a>
        </div>
      `;
    }
  }
});