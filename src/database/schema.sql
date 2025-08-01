-- Laundry Machine Timer Database Schema

-- Machines table to store laundry machine information and status
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('available', 'in-use')),
    timer_end_time INTEGER, -- Unix timestamp when timer expires (NULL when available)
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);

-- Create index on timer_end_time for efficient timer expiration checks
CREATE INDEX IF NOT EXISTS idx_machines_timer_end_time ON machines(timer_end_time);

-- Insert initial sample machines if they don't exist
-- This provides a realistic set of laundry machines for a typical facility
INSERT OR IGNORE INTO machines (name, status) VALUES 
    ('Washer 1', 'available'),
    ('Washer 2', 'available'),
    ('Washer 3', 'available'),
    ('Washer 4', 'available'),
    ('Dryer 1', 'available'),
    ('Dryer 2', 'available'),
    ('Dryer 3', 'available'),
    ('Dryer 4', 'available'),
    ('Heavy Duty Washer', 'available'),
    ('Heavy Duty Dryer', 'available');