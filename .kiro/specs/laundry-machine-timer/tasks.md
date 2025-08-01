# Implementation Plan

- [x] 1. Set up project structure and core configuration
  - Create TypeScript project with proper tsconfig.json
  - Set up package.json with required dependencies (express, sqlite3, @types packages)
  - Create directory structure for models, services, controllers, and database
  - _Requirements: 5.1, 5.3_

- [x] 2. Implement database schema and connection
  - Create SQLite database schema with machines table
  - Implement database connection utilities with proper error handling
  - Write database migration scripts for initial setup
  - _Requirements: 4.1, 4.2, 5.2_

- [x] 3. Create core data models and interfaces
  - Define TypeScript interfaces for Machine, TimerRequest, and MachineStatus
  - Implement Machine entity class with validation methods
  - Create type definitions for API requests and responses
  - _Requirements: 5.1, 5.3_

- [x] 4. Implement machine repository layer
  - Create MachineRepository class with CRUD operations
  - Implement database queries for machine status updates
  - Write methods for timer-related database operations
  - Add unit tests for repository methods
  - _Requirements: 4.1, 4.3_

- [x] 5. Build machine service layer
  - Implement MachineService with business logic for machine operations
  - Create methods for setting timers and updating machine status
  - Add validation for timer duration and machine availability
  - Write unit tests for service methods
  - _Requirements: 2.3, 2.5, 4.1_

- [x] 6. Create timer management system
  - Implement TimerManager service for background timer processing
  - Create timer expiration checking logic that runs every 30 seconds
  - Add functionality to restore active timers on server startup
  - Write unit tests for timer expiration logic
  - _Requirements: 3.1, 3.2, 3.3, 4.2_

- [x] 7. Build REST API endpoints
  - Create Express.js server setup with TypeScript
  - Implement GET /api/machines endpoint to list all machines
  - Implement POST /api/machines/:id/timer endpoint for setting timers
  - Add proper error handling and HTTP status codes
  - _Requirements: 1.1, 2.1, 2.3_

- [ ] 8. Add real-time status updates
  - Implement Server-Sent Events endpoint for real-time updates
  - Create status broadcasting when machine timers expire
  - Add fallback polling mechanism for clients
  - _Requirements: 1.4, 2.5, 3.2_

- [x] 9. Create frontend HTML structure
  - Build main page HTML with machine list display
  - Create timer setup page HTML with duration input form
  - Add basic CSS styling for user interface
  - _Requirements: 1.1, 2.1_

- [x] 10. Implement frontend TypeScript logic
  - Create MachineList component to display machines and their status
  - Implement TimerSetup component for setting machine timers
  - Add real-time status update handling using SSE
  - Write client-side validation for timer duration input
  - _Requirements: 1.2, 1.3, 2.2, 2.4_

- [x] 11. Add navigation and user flow
  - Implement routing between main page and timer setup page
  - Add click handlers for available machine links
  - Create redirect logic after timer is successfully set
  - _Requirements: 2.1, 2.4_

- [x] 12. Implement database initialization
  - Create seed data for initial laundry machines
  - Add database setup script that creates tables and sample data
  - Implement proper database connection error handling
  - _Requirements: 4.1, 4.2_

- [x] 13. Add comprehensive error handling
  - Implement API error responses for invalid requests
  - Add client-side error display for failed operations
  - Create proper error logging throughout the application
  - _Requirements: 2.3, 4.1_

- [x] 14. Write integration tests
  - Create tests for complete API workflows
  - Test timer expiration end-to-end functionality
  - Add tests for database persistence across server restarts
  - _Requirements: 3.1, 4.2, 4.3_

- [x] 15. Add application startup and configuration
  - Create main application entry point that initializes all services
  - Implement graceful shutdown handling
  - Add environment configuration for database path and server port
  - Wire together all components into working application
  - _Requirements: 4.2, 5.1_