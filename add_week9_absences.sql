-- Week 9 absences (February 24-28, 2025)
-- This file adds absence records for week 9 of 2025
-- To use this file for testing, run: sqlite3 data.db < add_week9_absences.sql

-- Nando Vos - Full week vacation (8 hours per day)
INSERT OR REPLACE INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name, created_at, updated_at)
VALUES (1003, 101725, '2025-02-24', '2025-02-28', 1, 'Vakantie', 8.0, 'Week 9 vacation', 2, 'Goedgekeurd', datetime('now'), datetime('now'));

-- Valentina Marino Arboleda - Full week vacation (8 hours per day)
INSERT OR REPLACE INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name, created_at, updated_at)
VALUES (1004, 101934, '2025-02-24', '2025-02-28', 1, 'Vakantie', 8.0, 'Week 9 vacation', 2, 'Goedgekeurd', datetime('now'), datetime('now'));

-- Anne de Jong - Partial hours vacation (2 hours per day)
INSERT OR REPLACE INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name, created_at, updated_at)
VALUES (1005, 102025, '2025-02-24', '2025-02-28', 1, 'Vakantie', 2.0, 'Week 9 partial vacation', 2, 'Goedgekeurd', datetime('now'), datetime('now'));

-- Anthony Mamaril - Partial week sick leave (2 hours per day for 3 days)
INSERT OR REPLACE INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name, created_at, updated_at)
VALUES (1006, 101911, '2025-02-24', '2025-02-26', 2, 'Ziek', 2.0, 'Week 9 partial sick leave', 2, 'Goedgekeurd', datetime('now'), datetime('now')); 