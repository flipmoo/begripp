-- Add grippId column to invoices table
ALTER TABLE invoices ADD COLUMN grippId INTEGER;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_grippId ON invoices (grippId);
