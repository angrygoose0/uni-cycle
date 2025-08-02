/**
 * ThemeManager handles dark/light mode switching and persistence
 */
export class ThemeManager {
  private static instance: ThemeManager | null = null;
  private currentTheme: 'light' | 'dark' = 'light';
  private toggleButton: HTMLButtonElement | null = null;

  private constructor() {
    this.loadSavedTheme();
    this.applyTheme();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Initialize theme manager with toggle button
   */
  init(): void {
    console.log('ThemeManager: Initializing...');
    this.toggleButton = document.getElementById('theme-toggle') as HTMLButtonElement;
    console.log('ThemeManager: Toggle button found:', !!this.toggleButton);
    
    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', () => {
        console.log('ThemeManager: Toggle button clicked');
        this.toggleTheme();
      });
      this.updateToggleButton();
      console.log('ThemeManager: Initialized successfully');
    } else {
      console.error('ThemeManager: Toggle button not found!');
    }
  }

  /**
   * Load saved theme from localStorage
   */
  private loadSavedTheme(): void {
    const savedTheme = localStorage.getItem('laundry-timer-theme') as 'light' | 'dark' | null;
    
    if (savedTheme) {
      this.currentTheme = savedTheme;
    } else {
      // Default to dark mode
      this.currentTheme = 'dark';
    }
  }

  /**
   * Apply current theme to document
   */
  private applyTheme(): void {
    if (this.currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /**
   * Update toggle button icon
   */
  private updateToggleButton(): void {
    if (this.toggleButton) {
      this.toggleButton.textContent = this.currentTheme === 'dark' ? '☀️' : '🌙';
      this.toggleButton.setAttribute('aria-label', 
        this.currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
    }
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme();
    this.updateToggleButton();
    this.saveTheme();
  }

  /**
   * Save current theme to localStorage
   */
  private saveTheme(): void {
    localStorage.setItem('laundry-timer-theme', this.currentTheme);
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }
}