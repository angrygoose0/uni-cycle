import { TimerSetup, getMachineIdFromUrl } from './TimerSetup.js';
import { ThemeManager } from './ThemeManager.js';

/**
 * Main entry point for the timer setup page
 * Initializes the TimerSetup component and theme manager
 */

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize theme manager first
    const themeManager = ThemeManager.getInstance();
    themeManager.init();

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