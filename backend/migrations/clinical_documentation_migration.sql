-- ============================================================================
-- CLINICAL DOCUMENTATION MIGRATION
-- Phase 1: Database Schema Enhancements & Security Foundation
-- ============================================================================

-- Add consultation notes to Appointment table (only if doesn't exist)
-- Check if column exists first
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'HMS' AND TABLE_NAME = 'appointment' AND COLUMN_NAME = 'consultation_notes';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE appointment ADD COLUMN consultation_notes TEXT COMMENT "Doctor consultation notes and diagnosis"',
  'SELECT "consultation_notes column already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add medical history fields to Patient table
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'HMS' AND TABLE_NAME = 'patient' AND COLUMN_NAME = 'medical_history';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE patient ADD COLUMN medical_history TEXT COMMENT "Patient medical history"',
  'SELECT "medical_history column already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add allergies column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'HMS' AND TABLE_NAME = 'patient' AND COLUMN_NAME = 'allergies';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE patient ADD COLUMN allergies TEXT COMMENT "Known allergies"',
  'SELECT "allergies column already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add current_medications column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'HMS' AND TABLE_NAME = 'patient' AND COLUMN_NAME = 'current_medications';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE patient ADD COLUMN current_medications TEXT COMMENT "Current medications"',
  'SELECT "current_medications column already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add address column if missing (for existing schema compatibility)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'HMS' AND TABLE_NAME = 'patient' AND COLUMN_NAME = 'address';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE patient ADD COLUMN address TEXT',
  'SELECT "address column already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure appointment_treatment table has correct structure
-- Check if table exists and has the right columns
CREATE TABLE IF NOT EXISTS appointment_treatment (
  appointment_id INT NOT NULL,
  service_code VARCHAR(50) NOT NULL,
  notes TEXT COMMENT 'Treatment-specific notes',
  actual_price DECIMAL(10,2) COMMENT 'Actual price charged (may differ from catalogue)',
  PRIMARY KEY (appointment_id, service_code),
  FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id) ON DELETE CASCADE,
  FOREIGN KEY (service_code) REFERENCES treatment_catalogue(service_code) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create session management table
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id INT NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES account_info(user_id) ON DELETE CASCADE,
  INDEX idx_session_user (user_id),
  INDEX idx_session_expiry (expires_at),
  INDEX idx_session_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create audit log table for compliance (Section 2.2, 5.7)
CREATE TABLE IF NOT EXISTS audit_log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(255) NOT NULL COMMENT 'HTTP method and path (e.g., POST /api/appointments)',
  table_name VARCHAR(100) COMMENT 'Affected table name',
  record_id VARCHAR(50) COMMENT 'Affected record ID',
  old_value TEXT COMMENT 'JSON of old values',
  new_value TEXT COMMENT 'JSON of new values',
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES account_info(user_id) ON DELETE CASCADE,
  INDEX idx_audit_user_timestamp (user_id, timestamp),
  INDEX idx_audit_table (table_name, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Audit log retained for 15 years per Section 5.7';

-- Create data access log for PDPA compliance
CREATE TABLE IF NOT EXISTS data_access_log (
  access_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  patient_id INT,
  action VARCHAR(50) NOT NULL COMMENT 'VIEW, EXPORT, etc.',
  endpoint VARCHAR(255) NOT NULL COMMENT 'API endpoint accessed',
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES account_info(user_id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
  INDEX idx_data_access_patient_timestamp (patient_id, timestamp),
  INDEX idx_data_access_user_timestamp (user_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PDPA compliance: Sri Lanka PDPA No. 9 of 2022';

-- Add indexes for performance optimization
-- Note: We'll ignore errors if indexes already exist

-- Index for appointment queries by doctor, status, and date
SET @index_exists = (SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema='HMS' AND table_name='appointment' AND index_name='idx_appointment_status_doctor');
SET @query = IF(@index_exists = 0,
  'CREATE INDEX idx_appointment_status_doctor ON appointment(doctor_id, status, schedule_date)',
  'SELECT "idx_appointment_status_doctor already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for appointment queries by doctor and date
SET @index_exists = (SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema='HMS' AND table_name='appointment' AND index_name='idx_appointment_doctor_date');
SET @query = IF(@index_exists = 0,
  'CREATE INDEX idx_appointment_doctor_date ON appointment(doctor_id, schedule_date)',
  'SELECT "idx_appointment_doctor_date already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for patient search
SET @index_exists = (SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema='HMS' AND table_name='patient' AND index_name='idx_patient_search');
SET @query = IF(@index_exists = 0,
  'CREATE INDEX idx_patient_search ON patient(name, contact_info)',
  'SELECT "idx_patient_search already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for patient date of birth
SET @index_exists = (SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema='HMS' AND table_name='patient' AND index_name='idx_patient_dob');
SET @query = IF(@index_exists = 0,
  'CREATE INDEX idx_patient_dob ON patient(date_of_birth)',
  'SELECT "idx_patient_dob already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for treatment by appointment
SET @index_exists = (SELECT COUNT(1) FROM information_schema.statistics
  WHERE table_schema='HMS' AND table_name='appointment_treatment' AND index_name='idx_treatment_appointment');
SET @query = IF(@index_exists = 0,
  'CREATE INDEX idx_treatment_appointment ON appointment_treatment(appointment_id)',
  'SELECT "idx_treatment_appointment already exists" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes for audit and access logs (if tables exist)
SET @table_exists = (SELECT COUNT(1) FROM information_schema.tables
  WHERE table_schema='HMS' AND table_name='audit_log');

SET @index_exists = IF(@table_exists > 0,
  (SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema='HMS' AND table_name='audit_log' AND index_name='idx_audit_log_user_timestamp'),
  1);

SET @query = IF(@table_exists > 0 AND @index_exists = 0,
  'CREATE INDEX idx_audit_log_user_timestamp ON audit_log(user_id, timestamp)',
  'SELECT "audit_log index skipped (table missing or index exists)" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = IF(@table_exists > 0,
  (SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema='HMS' AND table_name='audit_log' AND index_name='idx_audit_log_table'),
  1);

SET @query = IF(@table_exists > 0 AND @index_exists = 0,
  'CREATE INDEX idx_audit_log_table ON audit_log(table_name, timestamp)',
  'SELECT "audit_log table index skipped" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Indexes for data_access_log
SET @table_exists = (SELECT COUNT(1) FROM information_schema.tables
  WHERE table_schema='HMS' AND table_name='data_access_log');

SET @index_exists = IF(@table_exists > 0,
  (SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema='HMS' AND table_name='data_access_log' AND index_name='idx_data_access_patient_timestamp'),
  1);

SET @query = IF(@table_exists > 0 AND @index_exists = 0,
  'CREATE INDEX idx_data_access_patient_timestamp ON data_access_log(patient_id, timestamp)',
  'SELECT "data_access_log patient index skipped" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = IF(@table_exists > 0,
  (SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema='HMS' AND table_name='data_access_log' AND index_name='idx_data_access_user_timestamp'),
  1);

SET @query = IF(@table_exists > 0 AND @index_exists = 0,
  'CREATE INDEX idx_data_access_user_timestamp ON data_access_log(user_id, timestamp)',
  'SELECT "data_access_log user index skipped" AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify treatment_catalogue has required columns
-- Add base_price alias if needed (for compatibility)
-- Note: The table uses 'price' column, we'll handle this in the API layer

-- Add constraint to ensure treatments are only for completed appointments
-- This is enforced at application level, but we can add a trigger for extra safety
DELIMITER $$

DROP TRIGGER IF EXISTS enforce_completed_appointment_for_treatment$$

CREATE TRIGGER enforce_completed_appointment_for_treatment
BEFORE INSERT ON appointment_treatment
FOR EACH ROW
BEGIN
  DECLARE appt_status VARCHAR(50);

  SELECT status INTO appt_status
  FROM appointment
  WHERE appointment_id = NEW.appointment_id;

  IF appt_status != 'Completed' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'REQ-4.4.1: Treatments can only be added to completed appointments';
  END IF;
END$$

DELIMITER ;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Uncomment to verify schema changes
-- DESCRIBE appointment;
-- DESCRIBE patient;
-- DESCRIBE appointment_treatment;
-- DESCRIBE user_sessions;
-- SHOW INDEX FROM appointment;
-- SHOW TRIGGERS LIKE 'appointment_treatment';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
