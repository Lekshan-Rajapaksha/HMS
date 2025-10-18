-- ============================================================================
-- PHASE 1 DATABASE MIGRATIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Milestone 1.1: Clinical Documentation System
-- ----------------------------------------------------------------------------

-- Add medical history fields to Patient table
ALTER TABLE Patient
ADD COLUMN medical_history TEXT,
ADD COLUMN allergies TEXT,
ADD COLUMN current_medications TEXT;

-- Add consultation notes to Appointment table
ALTER TABLE Appointment
ADD COLUMN consultation_notes TEXT;

-- ----------------------------------------------------------------------------
-- Milestone 1.2: Security - Audit Logging
-- ----------------------------------------------------------------------------

-- Create audit log table for tracking all data modifications
CREATE TABLE IF NOT EXISTS audit_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(50) NOT NULL,
    old_value JSON,
    new_value JSON,
    ip_address VARCHAR(45),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Account_Info(user_id)
);

-- Create data access log table for tracking who views patient data
CREATE TABLE IF NOT EXISTS data_access_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    patient_id INT,
    action VARCHAR(50) NOT NULL, -- VIEW, EXPORT, PRINT
    endpoint VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Account_Info(user_id),
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id)
);

-- Add archived flag for soft deletes
ALTER TABLE Patient ADD COLUMN archived BOOLEAN DEFAULT FALSE;
ALTER TABLE Appointment ADD COLUMN archived BOOLEAN DEFAULT FALSE;
ALTER TABLE Invoice ADD COLUMN archived BOOLEAN DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- Milestone 1.4: Appointment Conflict Prevention
-- ----------------------------------------------------------------------------

-- Create doctor unavailability table
CREATE TABLE IF NOT EXISTS doctor_unavailability (
    unavailability_id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES Doctor(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES Account_Info(user_id)
);

-- Add index for frequently queried columns (Performance optimization)
-- Note: Some indexes already exist in base schema, only add new ones
CREATE INDEX IF NOT EXISTS idx_appointment_doctor_date ON Appointment(doctor_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_data_access_patient ON data_access_log(patient_id, timestamp);

-- ============================================================================
-- END MIGRATIONS
-- ============================================================================
