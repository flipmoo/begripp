PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE absence_requests (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    startdate DATE NOT NULL,
    enddate DATE NOT NULL,
    type_id INTEGER NOT NULL,
    type_name TEXT NOT NULL,
    hours_per_day REAL NOT NULL,
    description TEXT,
    status_id INTEGER NOT NULL,
    status_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);
INSERT INTO absence_requests VALUES(1001,101994,'2025-01-01','2025-01-03',1,'Vakantie',8.0,'New Year vacation',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1002,99623,'2025-01-01','2025-01-03',1,'Vakantie',8.0,'New Year vacation',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1003,101725,'2025-01-06','2025-01-10',1,'Vakantie',8.0,'Winter vacation',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1004,101994,'2025-01-13','2025-01-17',1,'Vakantie',8.0,'Winter vacation',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1005,99623,'2025-01-20','2025-01-24',2,'Ziekte',8.0,'Flu',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1006,101725,'2025-01-27','2025-01-31',2,'Ziekte',8.0,'Cold',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1007,101725,'2025-02-03','2025-02-07',2,'Ziekte',8.0,'Flu',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1009,99623,'2025-02-03','2025-02-07',1,'Vakantie',8.0,'Family trip',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1010,101725,'2025-02-10','2025-02-12',1,'Vakantie',8.0,'Short break',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1011,99623,'2025-02-19','2025-02-21',2,'Ziekte',8.0,'Migraine',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1012,101994,'2025-02-24','2025-02-28',2,'Ziekte',8.0,'COVID-19',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1013,101725,'2025-03-03','2025-03-07',1,'Vakantie',8.0,'Spring break',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1014,101994,'2025-01-06','2025-01-10',2,'Ziekte',8.0,'Flu',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(1015,99623,'2025-02-10','2025-02-14',1,'Vakantie',8.0,'City trip',2,'Goedgekeurd','2025-02-27 20:38:39','2025-02-27 20:38:39');
INSERT INTO absence_requests VALUES(9999,101725,'2025-02-24','2025-03-07',1,'Vakantie',8.0,'Test spanning multiple weeks',2,'Approved','2025-02-27 21:07:42','2025-02-27 21:07:42');
INSERT INTO absence_requests VALUES(10000,101725,'2025-03-10','2025-03-21',1,'Vakantie',8.0,'Test spanning multiple weeks',2,'Approved','2025-02-27 21:15:53','2025-02-27 21:15:53');
INSERT INTO absence_requests VALUES(10001,101725,'2025-03-01','2025-03-31',1,'Vakantie',8.0,'Test spanning entire month',2,'Approved','2025-02-27 21:16:50','2025-02-27 21:16:50');
INSERT INTO absence_requests VALUES(10002,101667,'2025-02-24','2025-02-28',1,'Vakantie',8.0,'Vacation',2,'Goedgekeurd','2025-02-28 05:47:31','2025-02-28 05:47:31');
INSERT INTO absence_requests VALUES(10003,101934,'2025-02-24','2025-02-28',2,'Ziekte',8.0,'Sick leave',2,'Goedgekeurd','2025-02-28 05:47:31','2025-02-28 05:47:31');
INSERT INTO absence_requests VALUES(10004,99622,'2025-02-24','2025-02-28',1,'Vakantie',8.0,'Vacation',2,'Goedgekeurd','2025-02-28 05:49:17','2025-02-28 05:49:17');
INSERT INTO absence_requests VALUES(10005,99623,'2025-02-24','2025-02-28',2,'Ziekte',8.0,'Sick leave',2,'Goedgekeurd','2025-02-28 05:49:17','2025-02-28 05:49:17');
INSERT INTO absence_requests VALUES(10006,99624,'2025-02-24','2025-02-28',1,'Vakantie',8.0,'Vacation',2,'Goedgekeurd','2025-02-28 05:49:17','2025-02-28 05:49:17');
INSERT INTO absence_requests VALUES(10007,99625,'2025-02-24','2025-02-28',2,'Ziekte',8.0,'Sick leave',2,'Goedgekeurd','2025-02-28 05:49:17','2025-02-28 05:49:17');
INSERT INTO absence_requests VALUES(10008,99627,'2025-02-24','2025-02-28',1,'Vakantie',8.0,'Vacation',2,'Goedgekeurd','2025-02-28 05:49:17','2025-02-28 05:49:17');
INSERT INTO absence_requests VALUES(20001,99622,'2025-02-07','2025-02-07',2,'Ziekte',8.0,'Sick day',2,'Goedgekeurd','2025-02-28 09:28:13','2025-02-28 09:28:13');
COMMIT;
