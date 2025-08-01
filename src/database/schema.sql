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