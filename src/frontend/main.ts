import { MachineList } from './MachineList.js';
import { ThemeManager } from './ThemeManager.js';

/**
 * Main entry point for the index page
 * Initializes the MachineList component and theme manager
 */

let machineList: MachineList | null = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize theme manager first
    const themeManager = ThemeManager.getInstance();
    themeManager.init();

    // Initialize machine list
    machineList = new MachineList('machine-list');
    await machineList.init();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // Show error message to user
    const container = document.getElementById('machine-list');
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <strong>Error:</strong> Failed to load the application. Please refresh the page or try again later.
        </div>
      `;
    }
  }
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
  if (machineList) {
    machineList.destroy();
  }
});