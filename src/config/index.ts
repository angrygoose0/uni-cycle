import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration module
 * Centralizes all environment variable handling and provides type-safe configuration
 */

export interface AppConfig {
  // Server configuration
  port: number;
  host: string;
  nodeEnv: string;
  
  // Database configuration
  databasePath: string;
  databaseTimeout: number;
  
  // Timer configuration
  timerCheckIntervalMs: number;
  maxTimerDurationMinutes: number;
  
  // Logging configuration
  logLevel: string;
  
  // Graceful shutdown configuration
  shutdownTimeoutMs: number;
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): AppConfig {
  const config: AppConfig = {
    // Server configuration
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Database configuration
    databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'laundry.db'),
    databaseTimeout: parseInt(process.env.DATABASE_TIMEOUT_MS || '30000', 10),
    
    // Timer configuration
    timerCheckIntervalMs: parseInt(process.env.TIMER_CHECK_INTERVAL_MS || '30000', 10),
    maxTimerDurationMinutes: parseInt(process.env.MAX_TIMER_DURATION_MINUTES || '300', 10),
    
    // Logging configuration
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Graceful shutdown configuration
    shutdownTimeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10),
  };

  // Validate configuration
  validateConfig(config);
  
  return config;
}

/**
 * Validate configuration values
 */
function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
  }

  // Validate database timeout
  if (config.databaseTimeout < 1000) {
    errors.push(`Invalid database timeout: ${config.databaseTimeout}ms. Must be at least 1000ms.`);
  }

  // Validate timer check interval
  if (config.timerCheckIntervalMs < 1000) {
    errors.push(`Invalid timer check interval: ${config.timerCheckIntervalMs}ms. Must be at least 1000ms.`);
  }

  // Validate max timer duration
  if (config.maxTimerDurationMinutes < 1 || config.maxTimerDurationMinutes > 1440) {
    errors.push(`Invalid max timer duration: ${config.maxTimerDurationMinutes} minutes. Must be between 1 and 1440 minutes (24 hours).`);
  }

  // Validate log level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logLevel.toLowerCase())) {
    errors.push(`Invalid log level: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}.`);
  }

  // Validate shutdown timeout
  if (config.shutdownTimeoutMs < 1000) {
    errors.push(`Invalid shutdown timeout: ${config.shutdownTimeoutMs}ms. Must be at least 1000ms.`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get application configuration
 * Loads configuration once and caches it
 */
let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Print configuration summary (without sensitive data)
 */
export function printConfigSummary(config: AppConfig): void {
  console.log('📋 Application Configuration:');
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Server: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.databasePath}`);
  console.log(`   Timer Check Interval: ${config.timerCheckIntervalMs}ms`);
  console.log(`   Max Timer Duration: ${config.maxTimerDurationMinutes} minutes`);
  console.log(`   Log Level: ${config.logLevel}`);
  console.log(`   Shutdown Timeout: ${config.shutdownTimeoutMs}ms`);
}