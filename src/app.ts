import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import { MachineController } from './controllers/MachineController';
import { StatusBroadcastService } from './services/StatusBroadcastService';
import { TimerManager } from './services/TimerManager';
import { MachineService } from './services/MachineService';
import { createLogger, setupGlobalErrorHandling } from './utils/logger';
import { getConfig, printConfigSummary, AppConfig } from './config';
import { getDatabase, closeDatabase } from './database/connection';

/**
 * Application class that manages the entire application lifecycle
 * Handles initialization, startup, and graceful shutdown
 */
export class Application {
  private app: express.Application;
  private server: Server | null = null;
  private config: AppConfig;
  private logger = createLogger('Application');
  
  // Services
  private statusBroadcastService: StatusBroadcastService | null = null;
  private machineService: MachineService | null = null;
  private timerManager: TimerManager | null = null;
  private machineController: MachineController | null = null;
  
  // Shutdown handling
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor() {
    this.config = getConfig();
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize all application services
   */
  private async initializeServices(): Promise<void> {
    this.logger.info('🔧 Initializing application services...');

    try {
      // Initialize database connection
      this.logger.info('📊 Connecting to database...');
      await getDatabase();
      this.logger.info('✅ Database connection established');

      // Initialize services in dependency order
      this.statusBroadcastService = new StatusBroadcastService();
      this.machineService = new MachineService();
      this.timerManager = new TimerManager(this.machineService, this.statusBroadcastService);
      this.machineController = new MachineController(this.machineService, this.statusBroadcastService);

      this.logger.info('✅ All services initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize services', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Set up global error handling first
    setupGlobalErrorHandling();

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve static files from public directory
    const publicPath = process.env.NODE_ENV === 'production' ? 'public' : 'src/public';
    this.app.use(express.static(publicPath));

    // Request logging middleware
    this.app.use((req, res, next) => {
      if (this.config.logLevel === 'debug') {
        this.logger.debug('HTTP Request', { 
          method: req.method, 
          path: req.path, 
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      }
      next();
    });

    // Health check middleware (always available)
    this.app.use('/health', (req, res, next) => {
      if (this.isShuttingDown) {
        res.status(503).json({
          status: 'shutting_down',
          timestamp: new Date().toISOString(),
          service: 'laundry-machine-timer'
        });
      } else {
        next();
      }
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'laundry-machine-timer',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime()
      });
    });

    // API Routes - these will be set up after services are initialized
    this.app.use('/api', (req, res, next) => {
      if (!this.machineController) {
        res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Application is still initializing'
        });
        return;
      }
      next();
    });
  }

  /**
   * Setup API routes after services are initialized
   */
  private setupApiRoutes(): void {
    if (!this.machineController) {
      throw new Error('Machine controller not initialized');
    }

    // Machine API endpoints
    this.app.get('/api/machines', (req, res) => this.machineController!.getAllMachines(req, res));
    this.app.post('/api/machines/:id/timer', (req, res) => this.machineController!.setTimer(req, res));

    // Real-time status update endpoints
    this.app.get('/api/machines/status', (req, res) => this.machineController!.getStatusUpdates(req, res));
    this.app.get('/api/machines/status/polling', (req, res) => this.machineController!.getStatusPolling(req, res));

    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `API endpoint ${req.method} ${req.originalUrl} not found`
      });
    });

    // Serve index.html for all non-API routes (SPA fallback)
    this.app.get('*', (req, res) => {
      const publicPath = process.env.NODE_ENV === 'production' ? 'public' : 'src/public';
      res.sendFile('index.html', { root: publicPath });
    });

    this.logger.info('✅ API routes configured');
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled Express error', err, { 
        method: req.method, 
        path: req.path, 
        body: req.body,
        params: req.params,
        query: req.query
      });
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    });
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Laundry Machine Timer application...');
      
      // Print configuration summary
      printConfigSummary(this.config);

      // Initialize services
      await this.initializeServices();

      // Setup API routes after services are ready
      this.setupApiRoutes();

      // Start HTTP server
      await this.startServer();

      // Start background services
      await this.startBackgroundServices();

      this.logger.info('🎉 Application started successfully!');
      this.printStartupInfo();

    } catch (error) {
      this.logger.error('❌ Failed to start application', error instanceof Error ? error : new Error(String(error)));
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Start the HTTP server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        this.logger.info(`🌐 HTTP server listening on ${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        this.logger.error('Server error', error);
        reject(error);
      });

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();
    });
  }

  /**
   * Start background services
   */
  private async startBackgroundServices(): Promise<void> {
    if (!this.timerManager) {
      throw new Error('Timer manager not initialized');
    }

    try {
      this.timerManager.start(this.config.timerCheckIntervalMs);
      this.logger.info(`⏰ Timer manager started with ${this.config.timerCheckIntervalMs}ms interval`);
    } catch (error) {
      this.logger.error('Failed to start timer manager', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Setup graceful shutdown signal handlers
   */
  private setupShutdownHandlers(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`📡 Received ${signal} signal, initiating graceful shutdown...`);
        this.shutdown().catch(error => {
          this.logger.error('Error during shutdown', error instanceof Error ? error : new Error(String(error)));
          process.exit(1);
        });
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error);
      this.shutdown().then(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', new Error(String(reason)), { promise });
      this.shutdown().then(() => process.exit(1));
    });
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return this.shutdownPromise || Promise.resolve();
    }

    this.isShuttingDown = true;
    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  /**
   * Perform the actual shutdown sequence
   */
  private async performShutdown(): Promise<void> {
    this.logger.info('🛑 Starting graceful shutdown...');
    
    const shutdownTimeout = setTimeout(() => {
      this.logger.error('⚠️  Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, this.config.shutdownTimeoutMs);

    try {
      // Stop accepting new connections
      if (this.server) {
        this.logger.info('🔌 Closing HTTP server...');
        await new Promise<void>((resolve) => {
          this.server!.close(() => {
            this.logger.info('✅ HTTP server closed');
            resolve();
          });
        });
      }

      // Stop background services
      if (this.timerManager) {
        this.logger.info('⏰ Stopping timer manager...');
        this.timerManager.cleanup();
        this.logger.info('✅ Timer manager stopped');
      }

      if (this.statusBroadcastService) {
        this.logger.info('📡 Stopping status broadcast service...');
        this.statusBroadcastService.cleanup();
        this.logger.info('✅ Status broadcast service stopped');
      }

      // Close database connection
      this.logger.info('📊 Closing database connection...');
      await closeDatabase();
      this.logger.info('✅ Database connection closed');

      clearTimeout(shutdownTimeout);
      this.logger.info('✅ Graceful shutdown completed');
      
    } catch (error) {
      clearTimeout(shutdownTimeout);
      this.logger.error('❌ Error during shutdown', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Print startup information
   */
  private printStartupInfo(): void {
    const baseUrl = `http://${this.config.host === '0.0.0.0' ? 'localhost' : this.config.host}:${this.config.port}`;
    
    this.logger.info('🔗 Application URLs:');
    this.logger.info(`   Main page: ${baseUrl}/`);
    this.logger.info(`   Health check: ${baseUrl}/health`);
    this.logger.info('');
    this.logger.info('📡 API Endpoints:');
    this.logger.info(`   GET  ${baseUrl}/api/machines - List all machines`);
    this.logger.info(`   POST ${baseUrl}/api/machines/:id/timer - Set timer for machine`);
    this.logger.info(`   GET  ${baseUrl}/api/machines/status - Real-time status updates (SSE)`);
    this.logger.info(`   GET  ${baseUrl}/api/machines/status/polling - Polling fallback for status updates`);
  }

  /**
   * Get the Express app instance (useful for testing)
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Check if the application is shutting down
   */
  public isShuttingDownStatus(): boolean {
    return this.isShuttingDown;
  }
}