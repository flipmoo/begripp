-- Migration to add absence request lines table
-- This table will store individual absence days within an absence request

-- Create the absence request lines table
CREATE TABLE IF NOT EXISTS absence_request_lines (
    id INTEGER PRIMARY KEY,
    absencerequest_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    startingtime TEXT,
    status_id INTEGER NOT NULL,
    status_name TEXT NOT NULL,
    createdon TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedon TEXT,
    searchname TEXT,
    extendedproperties TEXT,
    FOREIGN KEY (absencerequest_id) REFERENCES absence_requests(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_absence_line_request ON absence_request_lines (absencerequest_id);
CREATE INDEX IF NOT EXISTS idx_absence_line_date ON absence_request_lines (date); 