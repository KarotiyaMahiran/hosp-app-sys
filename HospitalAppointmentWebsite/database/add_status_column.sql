-- OPTIONAL: run only if you want Pending / Confirmed / Cancelled status updates
-- like the Java PDF project. Your current appointments table does not have a status column.
-- This does not recreate or delete any table or existing record.
USE hospital_db;
ALTER TABLE appointments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Pending';
