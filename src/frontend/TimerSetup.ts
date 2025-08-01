import { MachineStatus, SetTimerRequest, SetTimerResponse, ApiErrorResponse } from './types.js';

/**
 * TimerSetup component handles setting timers for machines
 * Includes client-side validation for timer duration input
 */
export class TimerSetup {
  private machineId: number;
  private machine: MachineStatus | null = null;
  private form: HTMLFormElement;
  private durationInput: HTMLInputElement;
  private machineNameElement: HTMLElement;
  private errorMessageElement: HTMLElement;
  private successMessageElement: HTMLElement;

  constructor(machineId: number) {
    this.machineId = machineId;
    
    // Get form elements
    const form = document.getElementById('timer-form') as HTMLFormElement;
    const durationInput = document.getElementById('duration') as HTMLInputElement;
    const machineNameElement = document.getElementById('machine-name');
    const errorMessageElement = document.getElementById('error-message');
    const successMessageElement = document.getElementById('success-message');

    if (!form || !durationInput || !machineNameElement || !errorMessageElement || !successMessageElement) {
      throw new Error('Required form elements not found');
    }

    this.form = form;
    this.durationInput = durationInput;
    this.machineNameElement = machineNameElement;
    this.errorMessageElement = errorMessageElement;
    this.successMessageElement = successMessageElement;
  }

  /**
   * Initialize the timer setup component
   */
  async init(): Promise<void> {
    try {
      await this.loadMachine();
      this.setupEventListeners();
      this.setupValidation();
    } catch (error) {
      console.error('Failed to initialize timer setup:', error);
      this.showError('Failed to load machine information. Please try again.');
    }
  }

  /**
   * Load machine information from the API
   */
  private async loadMachine(): Promise<void> {
    try {
      const response = await fetch('/api/machines');
      
      if (!response.ok) {
        let errorMessage = `Failed to load machine information (HTTP ${response.status})`;
        
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
      
      const data = await response.json();
      
      if (!data.machines || !Array.isArray(data.machines)) {
        throw new Error('Invalid response format from server');
      }
      
      const machine = data.machines.find((m: MachineStatus) => m.id === this.machineId);
      
      if (!machine) {
        throw new Error(`Machine with ID ${this.machineId} not found. It may have been removed.`);
      }

      if (machine.status !== 'available') {
        throw new Error(`Machine "${machine.name}" is currently in use. Please select a different machine.`);
      }

      this.machine = machine;
      this.machineNameElement.textContent = `Machine: ${machine.name}`;
    } catch (error) {
      console.error('Error loading machine:', error);
      
      // Provide more specific error messages based on error type
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Form submission
    this.form.addEventListener('submit', this.handleSubmit.bind(this));

    // Cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // Real-time validation on input
    this.durationInput.addEventListener('input', this.validateInput.bind(this));
    this.durationInput.addEventListener('blur', this.validateInput.bind(this));
  }

  /**
   * Set up input validation
   */
  private setupValidation(): void {
    // Set initial validation state
    this.validateInput();
  }

  /**
   * Validate duration input
   */
  private validateInput(): boolean {
    const value = parseInt(this.durationInput.value);
    const isValid = this.isValidDuration(value);
    
    // Update input styling and show validation feedback
    if (this.durationInput.value && !isValid) {
      this.durationInput.style.borderColor = '#e74c3c';
      this.showValidationError('Duration must be between 1 and 300 minutes');
    } else {
      this.durationInput.style.borderColor = '#ddd';
      this.hideValidationError();
    }

    return isValid;
  }

  /**
   * Show validation error message
   */
  private showValidationError(message: string): void {
    let validationElement = document.getElementById('validation-error');
    if (!validationElement) {
      validationElement = document.createElement('div');
      validationElement.id = 'validation-error';
      validationElement.className = 'validation-error';
      validationElement.style.cssText = 'color: #e74c3c; font-size: 0.9rem; margin-top: 5px;';
      this.durationInput.parentNode?.appendChild(validationElement);
    }
    validationElement.textContent = message;
    validationElement.style.display = 'block';
  }

  /**
   * Hide validation error message
   */
  private hideValidationError(): void {
    const validationElement = document.getElementById('validation-error');
    if (validationElement) {
      validationElement.style.display = 'none';
    }
  }

  /**
   * Check if duration is valid
   */
  private isValidDuration(duration: number): boolean {
    return !isNaN(duration) && duration >= 1 && duration <= 300;
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    
    const duration = parseInt(this.durationInput.value);
    
    // Client-side validation
    if (!this.isValidDuration(duration)) {
      this.showError('Please enter a valid duration between 1 and 300 minutes.');
      return;
    }

    if (!this.machine) {
      this.showError('Machine information not loaded. Please refresh the page.');
      return;
    }

    // Disable form during submission
    this.setFormEnabled(false);
    this.hideMessages();

    try {
      await this.setTimer(duration);
    } catch (error) {
      console.error('Error setting timer:', error);
      this.showError('Failed to set timer. Please try again.');
    } finally {
      this.setFormEnabled(true);
    }
  }

  /**
   * Set timer via API
   */
  private async setTimer(durationMinutes: number): Promise<void> {
    const requestData: SetTimerRequest = {
      durationMinutes
    };

    try {
      const response = await fetch(`/api/machines/${this.machineId}/timer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        let errorMessage = `Failed to set timer (HTTP ${response.status})`;
        
        try {
          const errorData = await response.json() as ApiErrorResponse;
          if (errorData.message) {
            errorMessage = errorData.message;
          }
          
          // Provide user-friendly messages for specific error types
          switch (errorData.error) {
            case 'MACHINE_NOT_FOUND':
              errorMessage = 'This machine is no longer available. Please go back and select a different machine.';
              break;
            case 'MACHINE_IN_USE':
              errorMessage = 'This machine is now in use by someone else. Please go back and select a different machine.';
              break;
            case 'INVALID_DURATION':
              errorMessage = 'The timer duration is invalid. Please enter a value between 1 and 300 minutes.';
              break;
            case 'INVALID_MACHINE_ID':
              errorMessage = 'Invalid machine selected. Please go back and try again.';
              break;
          }
        } catch {
          // If we can't parse the error response, use the default message
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const successData = data as SetTimerResponse;
      
      if (successData.success) {
        this.showSuccess(`Timer set successfully for ${durationMinutes} minutes!`);
        
        // Redirect to main page after 2 seconds
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);
      } else {
        throw new Error('Failed to set timer - unexpected response format');
      }
    } catch (error) {
      console.error('API error:', error);
      
      // Provide more specific error messages based on error type
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  /**
   * Enable/disable form elements
   */
  private setFormEnabled(enabled: boolean): void {
    const formElements = this.form.querySelectorAll('input, button');
    formElements.forEach(element => {
      (element as HTMLInputElement | HTMLButtonElement).disabled = !enabled;
    });
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.hideMessages();
    this.errorMessageElement.innerHTML = `
      ${message}
      <div style="margin-top: 10px;">
        <button class="btn btn-secondary" onclick="window.location.href='index.html'">
          Go Back to Machine List
        </button>
      </div>
    `;
    this.errorMessageElement.style.display = 'block';
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.hideMessages();
    this.successMessageElement.textContent = message;
    this.successMessageElement.style.display = 'block';
  }

  /**
   * Hide all messages
   */
  private hideMessages(): void {
    this.errorMessageElement.style.display = 'none';
    this.successMessageElement.style.display = 'none';
  }
}

/**
 * Utility function to get machine ID from URL parameters
 */
export function getMachineIdFromUrl(): number | null {
  const urlParams = new URLSearchParams(window.location.search);
  const machineIdParam = urlParams.get('machineId');
  
  if (!machineIdParam) {
    return null;
  }

  const machineId = parseInt(machineIdParam);
  return isNaN(machineId) ? null : machineId;
}