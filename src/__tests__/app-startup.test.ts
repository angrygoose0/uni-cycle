import { Application } from '../app';
import { getConfig, resetConfig } from '../config';
import path from 'path';

describe('Application Startup and Configuration', () => {
  let testDbPath: string;
  let originalDbPath: string | undefined;

  beforeAll(() => {
    // Set up test database path
    testDbPath = path.join(__dirname, 'test-app-startup.db');
    originalDbPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = testDbPath;
    
    // Reset config to pick up new environment variables
    resetConfig();
  });

  afterAll(() => {
    // Restore original database path
    if (originalDbPath) {
      process.env.DATABASE_PATH = originalDbPath;
    } else {
      delete process.env.DATABASE_PATH;
    }
    resetConfig();
  });

  describe('Configuration', () => {
    it('should load default configuration values', () => {
      const config = getConfig();
      
      expect(config.port).toBe(3000);
      expect(config.host).toBe('0.0.0.0');
      expect(config.nodeEnv).toBe('test'); // Jest sets NODE_ENV to 'test'
      expect(config.timerCheckIntervalMs).toBe(30000);
      expect(config.maxTimerDurationMinutes).toBe(300);
      expect(config.logLevel).toBe('info');
      expect(config.shutdownTimeoutMs).toBe(10000);
    });

    it('should validate configuration values', () => {
      // Test invalid port
      process.env.PORT = '99999';
      resetConfig();
      
      expect(() => getConfig()).toThrow('Configuration validation failed');
      
      // Reset to valid value
      delete process.env.PORT;
      resetConfig();
    });

    it('should load environment variables', () => {
      process.env.PORT = '8080';
      process.env.LOG_LEVEL = 'debug';
      process.env.TIMER_CHECK_INTERVAL_MS = '15000';
      resetConfig();
      
      const config = getConfig();
      
      expect(config.port).toBe(8080);
      expect(config.logLevel).toBe('debug');
      expect(config.timerCheckIntervalMs).toBe(15000);
      
      // Clean up
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;
      delete process.env.TIMER_CHECK_INTERVAL_MS;
      resetConfig();
    });
  });

  describe('Application Lifecycle', () => {
    let app: Application;

    afterEach(async () => {
      if (app) {
        await app.shutdown();
      }
    });

    it('should create application instance', () => {
      app = new Application();
      expect(app).toBeInstanceOf(Application);
      expect(app.getApp()).toBeDefined();
    });

    it('should start and shutdown gracefully', async () => {
      app = new Application();
      
      // Start the application
      await app.start();
      
      // Verify it's not shutting down initially
      expect(app.isShuttingDownStatus()).toBe(false);
      
      // Shutdown gracefully
      await app.shutdown();
      
      // Verify shutdown status
      expect(app.isShuttingDownStatus()).toBe(true);
    }, 15000); // Increase timeout for startup/shutdown

    it('should handle multiple shutdown calls gracefully', async () => {
      app = new Application();
      
      await app.start();
      
      // Call shutdown multiple times
      const shutdown1 = app.shutdown();
      const shutdown2 = app.shutdown();
      const shutdown3 = app.shutdown();
      
      // All should resolve without error
      await Promise.all([shutdown1, shutdown2, shutdown3]);
      
      expect(app.isShuttingDownStatus()).toBe(true);
    }, 15000);
  });
});