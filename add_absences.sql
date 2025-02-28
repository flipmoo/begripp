-- WARNING: THIS FILE CONTAINS TEST DATA ONLY
-- DO NOT EXECUTE THIS FILE IN PRODUCTION ENVIRONMENTS
-- This file will DELETE ALL absence_requests and insert test data
-- To use this file for testing, run: sqlite3 data.db < add_absences.sql

DELETE FROM absence_requests;
-- Group 1: One day of vacation (Monday)
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1001, 101994, '2025-02-03', '2025-02-03', 1, 'Vakantie', 8.0, 'Vacation day', 2, 'Goedgekeurd');
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1002, 99623, '2025-02-03', '2025-02-03', 1, 'Vakantie', 8.0, 'Vacation day', 2, 'Goedgekeurd');
-- Group 2: Two days of vacation (Monday-Tuesday)
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1004, 102025, '2025-02-03', '2025-02-04', 1, 'Vakantie', 8.0, 'Vacation days', 2, 'Goedgekeurd');
-- Group 3: Three days of sick leave (Wednesday-Friday)
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1007, 101911, '2025-02-05', '2025-02-07', 2, 'Ziekte', 8.0, 'Sick leave', 2, 'Goedgekeurd');
-- Group 4: Full week of vacation
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1010, 102044, '2025-02-03', '2025-02-07', 1, 'Vakantie', 8.0, 'Full week vacation', 2, 'Goedgekeurd');
-- Group 5: Full week of sick leave
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1013, 101725, '2025-02-03', '2025-02-07', 2, 'Ziekte', 8.0, 'Full week sick leave', 2, 'Goedgekeurd');
-- Group 6: Partial days (4 hours per day for the whole week)
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1016, 99622, '2025-02-03', '2025-02-07', 1, 'Vakantie', 4.0, 'Half days all week', 2, 'Goedgekeurd');
-- Group 7: Mixed absence types (vacation Monday-Tuesday, sick Wednesday-Friday)
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1019, 99627, '2025-02-03', '2025-02-04', 1, 'Vakantie', 8.0, 'Vacation days', 2, 'Goedgekeurd');
INSERT INTO absence_requests (id, employee_id, startdate, enddate, type_id, type_name, hours_per_day, description, status_id, status_name) VALUES (1020, 99627, '2025-02-05', '2025-02-07', 2, 'Ziekte', 8.0, 'Sick leave', 2, 'Goedgekeurd');
