# Design Document

## Overview

The frontend-only conversion transforms the existing laundry machine timer system from a client-server architecture to a pure frontend solution using browser localStorage for data persistence. The system maintains all existing functionality while eliminating backend dependencies, making it deployable on static hosting platforms like Vercel.

## Architecture

The system follows a single-tier frontend architecture:

1. **Frontend Application**: TypeScript-based web interface with embedded business logic
2. **Data Layer**: Browser localStorage for persistent data storage
3. **Timer Management**: Client-side JavaScript intervals for timer processing

### Technology Stack
- **Runtime**: Browser JavaScript (compiled from TypeScript)
- **Language**: TypeScript (compiled to ES2020+ for modern browser support)
- **Data Storage**: localStorage with sessionStorage fallback
- **Build System**: TypeScript compiler with static file generation
- **Hosting**: Static hosting (Vercel, Netlify, GitHub Pages)
- **Real-time Updates**: Storage events for cross-tab synchronization

## Components and Interfaces

### Data Storage Schema

```typescript
// localStorage key structure
interface LocalStorageSchema {
  'laundry-machines': MachineData[];
  'laundry-timer-theme': 'light' | 'dark';
}

interface MachineData {
  id: number;
  name: string;
  timerEndTime?: number; // Unix timestamp when timer expires
  createdAt: number;
  updatedAt: number;
}
```

### Core Interfaces (Preserved from Backend)

```typescript
interface MachineStatus {
  id: number;
  name: string;
  status: 'available' | 'in-use';
  remainingTimeMs?: number;
}

interface SetTimerRequest {
  durationMinutes: number;
}

interface StorageEvent {
  type: 'timer_set' | 'timer_expired' | 'machine_updated';
  machineId: number;
  timestamp: number;
}
```

### Frontend Services

1. **LocalStorageService**: Handles all localStorage operations with error handling
2. **MachineService**: Business logic for machine operations (converted from backend)
3. **TimerService**: Client-side timer management and expiration handling
4. **StorageEventService**: Cross-tab synchronization using storage events

## Components and Interfaces

### Core Services Architecture

#### LocalStorageService
```typescript
class LocalStorageService {
  // CRUD operations for machine data
  getMachines(): MachineData[]
  saveMachines(machines: MachineData[]): void
  isStorageAvailable(): boolean
  clearAllData(): void
}
```

#### MachineService (Frontend Version)
```typescript
class MachineService {
  // Converted from backend service
  getAllMachines(): MachineStatus[]
  getMachineById(id: number): MachineStatus | null
  setTimer(machineId: number, durationMinutes: number): MachineStatus
  clearTimer(machineId: number): MachineStatus
  initializeDefaultMachines(): void
}
```

#### TimerService
```typescript
class TimerService {
  // Client-side timer management
  startTimerMonitoring(): void
  stopTimerMonitoring(): void
  checkExpiredTimers(): void
  onTimerExpired: (machineId: number) => void
}
```

### UI Components (Enhanced Versions)

1. **MachineList Component**: Enhanced to work with localStorage instead of API calls
2. **TimerSetup Component**: Modified to use local storage instead of HTTP requests
3. **StorageSyncManager**: New component for cross-tab synchronization

## Data Models

### Machine Entity (Frontend Version)
- Converted from backend Machine class to work with localStorage
- Maintains same validation and business logic
- Status calculation based on client-side time comparison
- Timer expiration handled by client-side intervals

### Default Machine Data
```typescript
const DEFAULT_MACHINES: MachineData[] = [
  { id: 1, name: 'Washer 1', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 2, name: 'Washer 2', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 3, name: 'Dryer 1', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 4, name: 'Dryer 2', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 5, name: 'Dryer 3', createdAt: Date.now(), updatedAt: Date.now() }
];
```

## Error Handling

### Storage Errors
- localStorage unavailable: Fallback to sessionStorage or in-memory storage
- Storage quota exceeded: Clear expired timers and show user warning
- Data corruption: Reset to default machines with user notification

### Timer Errors
- Invalid duration: Client-side validation (1-120 minutes)
- Timer service failures: Graceful degradation with manual refresh option
- Cross-tab sync failures: Continue with local state, show sync warning

### Browser Compatibility
- Feature detection for localStorage support
- Graceful degradation for older browsers
- Polyfills for missing JavaScript features

## Testing Strategy

### Unit Tests
- LocalStorageService operations with mocked localStorage
- MachineService business logic (converted from backend tests)
- Timer expiration logic with mocked Date/setTimeout
- Cross-tab synchronization with simulated storage events

### Integration Tests
- Complete user workflows using jsdom or browser testing
- localStorage persistence across page refreshes
- Cross-tab synchronization scenarios
- Error handling and recovery scenarios

### Browser Testing
- Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- Mobile browser testing (iOS Safari, Chrome Mobile)
- localStorage behavior in private/incognito mode

## Implementation Notes

### Timer Management
- Use `setInterval` to check for expired timers every 30 seconds
- Store timer end times as Unix timestamps for timezone independence
- Handle page refresh by restoring active timers from localStorage on startup
- Synchronize timer updates across browser tabs using storage events

### Cross-Tab Synchronization
```typescript
// Storage event listener for cross-tab sync
window.addEventListener('storage', (event) => {
  if (event.key === 'laundry-machines') {
    // Update UI when another tab modifies machine data
    this.refreshMachineDisplay();
  }
});
```

### Data Migration
- Check for existing backend data and provide migration instructions
- Initialize with sensible defaults if no data exists
- Version localStorage schema for future updates

### Build and Deployment
- TypeScript compilation to ES2020+ for modern browser support
- Single HTML file with inlined CSS and JavaScript for simplicity
- Static asset optimization for fast loading
- Service worker for offline functionality (optional enhancement)

### Performance Considerations
- Minimize localStorage read/write operations
- Batch updates to reduce storage events
- Lazy load non-critical components
- Optimize timer checking frequency based on active timers

### Security Considerations
- No sensitive data stored (machine names and timers only)
- Client-side validation for all user inputs
- XSS protection through proper DOM manipulation
- No external API calls or data transmission

### Scalability Limitations
- localStorage size limit (~5-10MB depending on browser)
- Single-user system (no multi-user support)
- No server-side backup or synchronization
- Limited to machines that fit in browser storage

## Migration Strategy

### Phase 1: Create Frontend-Only Version
1. Convert backend services to frontend classes
2. Replace API calls with localStorage operations
3. Implement client-side timer management
4. Add cross-tab synchronization

### Phase 2: Build and Deployment Setup
1. Configure TypeScript build for browser target
2. Create static file generation process
3. Set up Vercel deployment configuration
4. Test deployment and functionality

### Phase 3: Feature Parity Verification
1. Verify all existing features work identically
2. Test edge cases and error scenarios
3. Ensure UI/UX remains consistent
4. Performance testing and optimization

## Deployment Configuration

### Vercel Configuration
```json
// vercel.json
{
  "builds": [
    {
      "src": "src/frontend/**/*.ts",
      "use": "@vercel/static-build",
      "config": {
        "buildCommand": "npm run build:frontend-only"
      }
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### Build Process
```json
// package.json scripts
{
  "build:frontend-only": "tsc -p tsconfig.frontend-only.json && cp src/public/*.html dist/ && cp src/public/*.css dist/",
  "dev:frontend-only": "tsc -p tsconfig.frontend-only.json --watch"
}
```