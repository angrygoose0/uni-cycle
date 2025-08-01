import { Application } from './app';
import { createLogger } from './utils/logger';

/**
 * Main application entry point
 * Creates and starts the application using the Application class
 */

const logger = createLogger('Main');

/**
 * Start the application
 */
async function main(): Promise<void> {
  try {
    const app = new Application();
    await app.start();
  } catch (error) {
    logger.error('❌ Failed to start application', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Start the application if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('❌ Unhandled error in main', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  });
}

// Export the Application class for testing and other uses
export { Application } from './app';