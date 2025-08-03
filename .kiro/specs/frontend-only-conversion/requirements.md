# Requirements Document

## Introduction

This feature converts the existing laundry machine timer system from a backend/frontend architecture to a frontend-only solution that can be hosted on static hosting platforms like Vercel. The system will maintain all existing functionality while eliminating the need for a backend server by using browser storage (localStorage) for data persistence and client-side timer management.

## Requirements

### Requirement 1

**User Story:** As a user, I want to view all laundry machines and their current status in a frontend-only application, so that I can find an available machine without requiring a backend server.

#### Acceptance Criteria

1. WHEN a user visits the main page THEN the system SHALL display a list of all laundry machines using client-side rendering
2. WHEN displaying machines THEN the system SHALL show each machine's current status (available, in-use, or timer remaining) from localStorage
3. WHEN a machine is available THEN the system SHALL display it as a clickable link
4. WHEN a machine is in-use THEN the system SHALL display the remaining time calculated client-side
5. WHEN the page loads THEN the system SHALL initialize default machines if no data exists in localStorage

### Requirement 2

**User Story:** As a user, I want to set a timer on an available laundry machine using only frontend code, so that I can reserve it for my laundry cycle without backend dependencies.

#### Acceptance Criteria

1. WHEN a user clicks on an available machine link THEN the system SHALL navigate to a timer setup page using client-side routing
2. WHEN on the timer setup page THEN the system SHALL allow the user to specify usage duration with client-side validation
3. WHEN a user submits a valid duration THEN the system SHALL start the timer and store the data in localStorage
4. WHEN a timer is set THEN the system SHALL redirect the user back to the main page using client-side navigation
5. WHEN a timer is active THEN the system SHALL display the remaining time using client-side calculations

### Requirement 3

**User Story:** As a user, I want machines to automatically become available when timers expire using client-side logic, so that the system works without a backend server.

#### Acceptance Criteria

1. WHEN a machine timer reaches zero THEN the system SHALL automatically change the machine status to available using client-side timer logic
2. WHEN a timer expires THEN the system SHALL update localStorage and refresh the display
3. WHEN a timer expires THEN the system SHALL remove the timer data from localStorage
4. WHEN the main page is viewed THEN the system SHALL show current real-time status calculated from localStorage data

### Requirement 4

**User Story:** As a developer, I want machine data to be persisted in browser storage, so that the system maintains state across page refreshes without requiring a backend database.

#### Acceptance Criteria

1. WHEN a timer is set THEN the system SHALL store the machine status and timer information in localStorage
2. WHEN the page is refreshed THEN the system SHALL restore all active timers from localStorage
3. WHEN a timer expires THEN the system SHALL update the machine status in localStorage
4. WHEN querying machine status THEN the system SHALL retrieve current data from localStorage
5. WHEN localStorage is not available THEN the system SHALL gracefully degrade with session-only storage

### Requirement 5

**User Story:** As a developer, I want the frontend-only system to be deployable on Vercel, so that it can be hosted without backend infrastructure costs.

#### Acceptance Criteria

1. WHEN building the application THEN the system SHALL generate only static files (HTML, CSS, JS)
2. WHEN deploying THEN the system SHALL work on static hosting platforms like Vercel
3. WHEN implementing the system THEN the system SHALL use TypeScript compiled to browser-compatible JavaScript
4. WHEN designing the architecture THEN the system SHALL eliminate all backend dependencies
5. WHEN packaging the application THEN the system SHALL include all necessary assets in the static build

### Requirement 6

**User Story:** As a user, I want the frontend-only system to handle multiple browser tabs gracefully, so that timer updates are synchronized across tabs.

#### Acceptance Criteria

1. WHEN multiple tabs are open THEN the system SHALL synchronize timer updates across all tabs using storage events
2. WHEN a timer is set in one tab THEN other tabs SHALL immediately reflect the change
3. WHEN a timer expires THEN all open tabs SHALL update to show the machine as available
4. WHEN localStorage is modified THEN the system SHALL broadcast changes to all active tabs

### Requirement 7

**User Story:** As a developer, I want to maintain the existing user interface and experience, so that users don't need to learn a new system.

#### Acceptance Criteria

1. WHEN converting to frontend-only THEN the system SHALL preserve the existing UI design and layout
2. WHEN users interact with the system THEN the behavior SHALL match the current backend version
3. WHEN displaying machine status THEN the visual presentation SHALL remain consistent
4. WHEN setting timers THEN the user flow SHALL be identical to the current implementation