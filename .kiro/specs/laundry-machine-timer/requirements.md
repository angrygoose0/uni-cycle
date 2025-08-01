# Requirements Document

## Introduction

This feature enables users to manage laundry machine usage through a web interface. Users can view available laundry machines, set usage timers when they start using a machine, and automatically return machines to available status when timers expire. The system provides real-time status tracking of all laundry machines in a facility.

## Requirements

### Requirement 1

**User Story:** As a user, I want to view all laundry machines and their current status, so that I can find an available machine to use.

#### Acceptance Criteria

1. WHEN a user visits the main page THEN the system SHALL display a list of all laundry machines
2. WHEN displaying machines THEN the system SHALL show each machine's current status (available, in-use, or timer remaining)
3. WHEN a machine is available THEN the system SHALL display it as a clickable link
4. WHEN a machine is in-use THEN the system SHALL display the remaining time on the timer

### Requirement 2

**User Story:** As a user, I want to set a timer on an available laundry machine, so that I can reserve it for my laundry cycle.

#### Acceptance Criteria

1. WHEN a user clicks on an available machine link THEN the system SHALL navigate to a timer setup page
2. WHEN on the timer setup page THEN the system SHALL allow the user to specify usage duration
3. WHEN a user submits a valid duration THEN the system SHALL start the timer and mark the machine as in-use
4. WHEN a timer is set THEN the system SHALL redirect the user back to the main page
5. WHEN a timer is active THEN the system SHALL display the remaining time in real-time

### Requirement 3

**User Story:** As a user, I want machines to automatically become available when timers expire, so that I don't need to manually update the status.

#### Acceptance Criteria

1. WHEN a machine timer reaches zero THEN the system SHALL automatically change the machine status to available
2. WHEN a timer expires THEN the system SHALL update the display to show the machine as available
3. WHEN a timer expires THEN the system SHALL remove the timer from the machine record
4. WHEN the main page is viewed THEN the system SHALL show current real-time status of all machines

### Requirement 4

**User Story:** As a system administrator, I want machine data to be persisted reliably, so that the system maintains state across server restarts.

#### Acceptance Criteria

1. WHEN a timer is set THEN the system SHALL store the machine status and timer information in the database
2. WHEN the server restarts THEN the system SHALL restore all active timers from the database
3. WHEN a timer expires THEN the system SHALL update the machine status in the database
4. WHEN querying machine status THEN the system SHALL retrieve current data from the database

### Requirement 5

**User Story:** As a developer, I want the system to use TypeScript and SQLite/Turso, so that the codebase is type-safe and uses the specified technology stack.

#### Acceptance Criteria

1. WHEN implementing the system THEN the system SHALL use TypeScript for all application code
2. WHEN implementing data storage THEN the system SHALL use SQLite or Turso as the database
3. WHEN building the application THEN the system SHALL maintain type safety throughout the codebase
4. WHEN designing the architecture THEN the system SHALL follow simple, straightforward patterns