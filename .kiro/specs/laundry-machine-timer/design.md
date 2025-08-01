# Design Document

## Overview

The laundry machine timer system is a web application built with TypeScript that manages laundry machine availability and usage timers. The system uses a simple client-server architecture with SQLite/Turso for data persistence and real-time updates for timer display.

## Architecture

The system follows a simple three-tier architecture:

1. **Frontend**: TypeScript-based web interface for user interactions
2. **Backend**: TypeScript Node.js server with REST API endpoints
3. **Database**: SQLite/Turso for persistent data storage

### Technology Stack
- **Runtime**: Node.js
- **Language**: TypeScript
- **Database**: SQLite (with Turso as cloud option)
- **Web Framework**: Express.js (simple and lightweight)
- **Frontend**: Vanilla TypeScript with HTML/CSS (keeping it simple)
- **Real-time Updates**: Server-Sent Events (SSE) or polling

## Components and Interfaces

### Database Schema

```sql
-- Machines table
CREATE TABLE machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('available', 'in-use')),
    timer_end_time INTEGER, -- Unix timestamp when timer expires
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### Core Interfaces

```typescript
interface Machine {
    id: number;
    name: string;
    status: 'available' | 'in-use';
    timerEndTime?: number; // Unix timestamp
    createdAt: number;
    updatedAt: number;
}

interface TimerRequest {
    machineId: number;
    durationMinutes: number;
}

interface MachineStatus {
    id: number;
    name: string;
    status: 'available' | 'in-use';
    remainingTimeMs?: number;
}
```

### API Endpoints

```typescript
// GET /api/machines - Get all machines with current status
// POST /api/machines/:id/timer - Set timer for a machine
// GET /api/machines/status - Get real-time status updates (SSE)
```

### Core Services

1. **MachineService**: Handles machine CRUD operations and timer logic
2. **TimerService**: Manages active timers and automatic expiration
3. **DatabaseService**: Handles SQLite/Turso connections and queries

## Components and Interfaces

### Frontend Components

1. **MachineList Component**: Displays all machines with their current status
2. **TimerSetup Component**: Allows users to set timer duration for a machine
3. **StatusUpdater**: Handles real-time updates of machine status

### Backend Services

1. **MachineController**: REST API endpoints for machine operations
2. **MachineRepository**: Database access layer for machine data
3. **TimerManager**: Background service for timer expiration handling

## Data Models

### Machine Entity
- Represents a physical laundry machine
- Tracks current status and timer information
- Maintains audit trail with created/updated timestamps

### Timer Logic
- Timers are stored as end timestamps (Unix time)
- Background process checks for expired timers every 30 seconds
- Expired timers automatically update machine status to 'available'

## Error Handling

### Database Errors
- Connection failures: Retry with exponential backoff
- Constraint violations: Return appropriate HTTP status codes
- Transaction failures: Rollback and return error response

### Timer Errors
- Invalid duration: Validate input (1-300 minutes)
- Machine already in use: Return conflict status
- Timer service failures: Log errors and continue operation

### API Errors
- Malformed requests: Return 400 Bad Request
- Machine not found: Return 404 Not Found
- Server errors: Return 500 Internal Server Error with generic message

## Testing Strategy

### Unit Tests
- Service layer methods (MachineService, TimerService)
- Database repository operations
- Timer expiration logic
- Input validation functions

### Integration Tests
- API endpoint functionality
- Database operations with test database
- Timer expiration workflow
- Real-time status updates

### End-to-End Tests
- Complete user workflows (view machines → set timer → timer expires)
- Cross-browser compatibility for frontend
- Database persistence across server restarts

## Implementation Notes

### Timer Management
- Use `setInterval` to check for expired timers every 30 seconds
- Store timer end times as Unix timestamps for timezone independence
- Handle server restarts by restoring active timers from database on startup

### Real-time Updates
- Implement Server-Sent Events for real-time status updates
- Fallback to polling every 10 seconds if SSE not supported
- Update only changed machine statuses to minimize bandwidth

### Database Choice
- Start with SQLite for simplicity
- Turso can be used as drop-in replacement for cloud deployment
- Use prepared statements to prevent SQL injection
- Implement connection pooling for better performance

### Scalability Considerations
- Single server instance sufficient for typical laundry facility
- Database can handle hundreds of machines without performance issues
- Timer checking frequency can be adjusted based on load