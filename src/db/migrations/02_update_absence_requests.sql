-- Migration to update absence requests table to match the Gripp API structure

-- First, create a backup of the existing table
CREATE TABLE absence_requests_backup AS SELECT * FROM absence_requests;

-- Drop the existing table
DROP TABLE IF EXISTS absence_requests;

-- Create the updated absence requests table
CREATE TABLE IF NOT EXISTS absence_requests (
    id INTEGER PRIMARY KEY,
    description TEXT,
    comment TEXT,
    createdon TEXT,
    updatedon TEXT,
    searchname TEXT DEFAULT 'NOT SET',
    extendedproperties TEXT,
    employee_id INTEGER NOT NULL,
    employee_searchname TEXT,
    employee_discr TEXT DEFAULT 'medewerker',
    absencetype_id INTEGER NOT NULL,
    absencetype_searchname TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_absence_employee ON absence_requests (employee_id);

-- Migrate data from the backup table to the new table
INSERT INTO absence_requests (
    id, 
    description, 
    employee_id, 
    absencetype_id, 
    absencetype_searchname,
    createdon
)
SELECT 
    id, 
    description, 
    employee_id, 
    type_id, 
    type_name,
    created_at
FROM 
    absence_requests_backup;

-- Update the employee_searchname field
UPDATE absence_requests
SET employee_searchname = (
    SELECT firstname || ' ' || lastname 
    FROM employees 
    WHERE employees.id = absence_requests.employee_id
);

-- Set default description if it's NULL
UPDATE absence_requests
SET description = 'Incidenteel verlof periode ' || substr(createdon, 1, 7)
WHERE description IS NULL; 