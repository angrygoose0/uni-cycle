-- Laundry Machine Timer Database Schema

-- Machines table to store laundry machine information
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    timer_end_time INTEGER, -- Unix timestamp when timer expires (NULL when no timer set)
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Create index on timer_end_time for efficient timer checks
CREATE INDEX IF NOT EXISTS idx_machines_timer_end_time ON machines(timer_end_time);

-- Action logs table to store all timer actions
CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    machine_name TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('set_timer', 'clear_timer', 'timer_expired')),
    duration_minutes INTEGER, -- Duration in minutes (NULL for clear_timer and timer_expired actions)
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying of action logs
CREATE INDEX IF NOT EXISTS idx_action_logs_machine_id ON action_logs(machine_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_timestamp ON action_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_action_logs_action_type ON action_logs(action_type);

-- Insert initial sample machines if they don't exist
-- This provides a realistic set of laundry machines for a typical facility
INSERT OR IGNORE INTO machines (name) VALUES 
    ('Washer 1'),
    ('Washer 2'),
    ('Washer 3'),
    ('Washer 4'),
    ('Dryer 1'),
    ('Dryer 2'),
    ('Dryer 3'),
    ('Dryer 4'),
    ('Heavy Duty Washer'),
    ('Heavy Duty Dryer');