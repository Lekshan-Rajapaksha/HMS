-- ============================================
-- COMPLETE CLINIC MANAGEMENT DATABASE
-- WITH SCHEMA, TRIGGERS, PROCEDURES, VIEWS & SAMPLE DATA
-- ============================================
-- ============================================
-- DROP EXISTING OBJECTS (IF EXIST)
-- ============================================

-- Disable foreign key checks temporarily to avoid constraint errors
SET FOREIGN_KEY_CHECKS = 0;

-- Drop views if they exist
DROP VIEW IF EXISTS vw_insurance_analysis;
DROP VIEW IF EXISTS vw_treatment_statistics;
DROP VIEW IF EXISTS vw_patients_outstanding;
DROP VIEW IF EXISTS vw_doctor_revenue;
DROP VIEW IF EXISTS vw_branch_appointment_summary;

-- Drop stored procedures if they exist
DROP PROCEDURE IF EXISTS CalculateInvoiceFromTreatments;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS UpdateInvoiceStatusAfterPayment;
DROP TRIGGER IF EXISTS PreventDoctorDeletionWithAppointments;
DROP TRIGGER IF EXISTS PreventOverlappingAppointmentsOnUpdate;
DROP TRIGGER IF EXISTS PreventOverlappingAppointments;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS Insurance_Claim;
DROP TABLE IF EXISTS Payment;
DROP TABLE IF EXISTS Invoice;
DROP TABLE IF EXISTS Appointment_Treatment;
DROP TABLE IF EXISTS Treatment_Catalogue;
DROP TABLE IF EXISTS rescheduled_appointments;
DROP TABLE IF EXISTS Appointment;
DROP TABLE IF EXISTS Patient;
DROP TABLE IF EXISTS Insurance_Provider;
DROP TABLE IF EXISTS doctor_specialties;
DROP TABLE IF EXISTS Doctor;
DROP TABLE IF EXISTS Specialties;
DROP TABLE IF EXISTS Staff;
DROP TABLE IF EXISTS Branch;
DROP TABLE IF EXISTS Account_Info;
DROP TABLE IF EXISTS Role;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- TABLE DEFINITIONS
-- ============================================

-- Role Table
CREATE TABLE Role (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    access_details TEXT
);

-- Account Info Table
CREATE TABLE Account_Info (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    last_login DATETIME DEFAULT NULL,
    FOREIGN KEY (role_id) REFERENCES Role(role_id)
);

-- Branch Table (references Staff for manager)
CREATE TABLE Branch (
    branch_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20),
    address VARCHAR(255),
    manager_user_id INT DEFAULT NULL
);

-- Staff Table
CREATE TABLE Staff (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    contact_info VARCHAR(255),
    is_medical_staff BOOLEAN DEFAULT FALSE,
    branch_id INT,
    FOREIGN KEY (user_id) REFERENCES Account_Info(user_id),
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id)
);

-- Add foreign key from Branch to Staff after Staff table is created
ALTER TABLE Branch
ADD CONSTRAINT fk_branch_manager FOREIGN KEY (manager_user_id) REFERENCES Staff(user_id);

-- Specialties Table
CREATE TABLE Specialties (
    specialty_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- Doctor Table
CREATE TABLE Doctor (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL UNIQUE,
    FOREIGN KEY (staff_id) REFERENCES Staff(staff_id)
);

-- Doctor Specialties (Many-to-Many)
CREATE TABLE doctor_specialties (
    doctor_id INT NOT NULL,
    specialty_id INT NOT NULL,
    PRIMARY KEY (doctor_id, specialty_id),
    FOREIGN KEY (doctor_id) REFERENCES Doctor(doctor_id),
    FOREIGN KEY (specialty_id) REFERENCES Specialties(specialty_id)
);

-- Insurance Provider Table
CREATE TABLE Insurance_Provider (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20)
);

-- Patient Table
CREATE TABLE Patient (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(10),
    date_of_birth DATE NOT NULL,
    contact_info VARCHAR(255),
    emergency_contact VARCHAR(255),
    insurance_provider_id INT,
    policy_number VARCHAR(50),
    FOREIGN KEY (insurance_provider_id) REFERENCES Insurance_Provider(id) ON DELETE SET NULL
);

-- Appointment Table (with consultation_notes added)
CREATE TABLE Appointment (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT,
    branch_id INT,
    schedule_date DATETIME NOT NULL,
    status ENUM('Scheduled', 'Completed', 'Cancelled', 'Rescheduled') NOT NULL DEFAULT 'Scheduled',
    consultation_notes TEXT,
    is_emergency BOOLEAN DEFAULT FALSE,
    reschedule_id INT DEFAULT NULL,
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES Doctor(doctor_id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id) ON DELETE SET NULL
);

-- Rescheduled Appointments Log
CREATE TABLE rescheduled_appointments (
    reschedule_id INT AUTO_INCREMENT PRIMARY KEY,
    previous_appointment_id INT NOT NULL,
    previous_date DATETIME NOT NULL,
    new_date DATETIME NOT NULL,
    rescheduled_by_staff_id INT NOT NULL,
    reschedule_reason TEXT,
    FOREIGN KEY (previous_appointment_id) REFERENCES Appointment(appointment_id) ON DELETE CASCADE,
    FOREIGN KEY (rescheduled_by_staff_id) REFERENCES Staff(staff_id)
);

-- Treatment Catalogue
CREATE TABLE Treatment_Catalogue (
    service_code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL
);

-- Appointment Treatment (Junction Table)
CREATE TABLE Appointment_Treatment (
    appointment_id INT NOT NULL,
    service_code VARCHAR(50) NOT NULL,
    notes TEXT,
    actual_price DECIMAL(10, 2),
    PRIMARY KEY (appointment_id, service_code),
    FOREIGN KEY (appointment_id) REFERENCES Appointment(appointment_id) ON DELETE CASCADE,
    FOREIGN KEY (service_code) REFERENCES Treatment_Catalogue(service_code)
);

-- Invoice Table
CREATE TABLE Invoice (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL UNIQUE,
    total_amount DECIMAL(10, 2) NOT NULL,
    insurance_coverage DECIMAL(10, 2) DEFAULT 0.00,
    out_of_pocket_amount DECIMAL(10, 2) NOT NULL,
    due_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    issued_date DATE NOT NULL,
    due_date DATE NOT NULL,
    FOREIGN KEY (appointment_id) REFERENCES Appointment(appointment_id) ON DELETE CASCADE
);

-- Payment Table
CREATE TABLE Payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    paid_amount DECIMAL(10, 2) NOT NULL,
    payment_date DATETIME NOT NULL,
    method_of_payment VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES Invoice(invoice_id) ON DELETE CASCADE
);

-- Insurance Claim Table
CREATE TABLE Insurance_Claim (
    claim_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    insurance_provider_id INT NOT NULL,
    claimed_amount DECIMAL(10, 2) NOT NULL,
    claim_status VARCHAR(20) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES Invoice(invoice_id) ON DELETE CASCADE,
    FOREIGN KEY (insurance_provider_id) REFERENCES Insurance_Provider(id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_appointment_schedule ON Appointment(schedule_date);
CREATE INDEX idx_appointment_status ON Appointment(status);
CREATE INDEX idx_appointment_doctor_date ON Appointment(doctor_id, schedule_date);
CREATE INDEX idx_invoice_status ON Invoice(status);
CREATE INDEX idx_invoice_due_date ON Invoice(due_date);
CREATE INDEX idx_payment_date ON Payment(payment_date);

-- ============================================
-- TRIGGERS
-- ============================================

-- Prevent Overlapping Appointments (INSERT)
CREATE TRIGGER PreventOverlappingAppointments
BEFORE INSERT ON Appointment
FOR EACH ROW
BEGIN
    DECLARE overlap_count INT;

    SELECT COUNT(*) INTO overlap_count
    FROM Appointment
    WHERE doctor_id = NEW.doctor_id
      AND status IN ('Scheduled', 'Rescheduled')
      AND ABS(TIMESTAMPDIFF(MINUTE, schedule_date, NEW.schedule_date)) < 30;

    IF overlap_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'This doctor already has an appointment at this time.';
    END IF;
END;

-- Prevent Overlapping Appointments (UPDATE)
CREATE TRIGGER PreventOverlappingAppointmentsOnUpdate
BEFORE UPDATE ON Appointment
FOR EACH ROW
BEGIN
    DECLARE overlap_count INT;

    IF NEW.schedule_date != OLD.schedule_date THEN
        SELECT COUNT(*) INTO overlap_count
        FROM Appointment
        WHERE doctor_id = NEW.doctor_id
          AND appointment_id != NEW.appointment_id
          AND status IN ('Scheduled', 'Rescheduled')
          AND ABS(TIMESTAMPDIFF(MINUTE, schedule_date, NEW.schedule_date)) < 30;

        IF overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This doctor already has an appointment at this time.';
        END IF;
    END IF;
END;

-- Prevent Doctor Deletion with Future Appointments
CREATE TRIGGER PreventDoctorDeletionWithAppointments
BEFORE DELETE ON Doctor
FOR EACH ROW
BEGIN
    DECLARE future_appointments INT;

    SELECT COUNT(*) INTO future_appointments
    FROM Appointment
    WHERE doctor_id = OLD.doctor_id AND schedule_date >= CURDATE();

    IF future_appointments > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot delete doctor. They have future appointments scheduled.';
    END IF;
END;

-- Update Invoice Status After Payment
CREATE TRIGGER UpdateInvoiceStatusAfterPayment
AFTER INSERT ON Payment
FOR EACH ROW
BEGIN
    DECLARE total_paid DECIMAL(10, 2);
    DECLARE invoice_total DECIMAL(10, 2);

    SELECT total_amount INTO invoice_total
    FROM Invoice WHERE invoice_id = NEW.invoice_id;

    SELECT SUM(paid_amount) INTO total_paid
    FROM Payment WHERE invoice_id = NEW.invoice_id;

    IF total_paid >= invoice_total THEN
        UPDATE Invoice SET status = 'Paid' WHERE invoice_id = NEW.invoice_id;
    ELSEIF total_paid > 0 THEN
        UPDATE Invoice SET status = 'Partially Paid' WHERE invoice_id = NEW.invoice_id;
    END IF;
END;

-- ============================================
-- STORED PROCEDURES
-- ============================================

-- Calculate Invoice From Treatments
CREATE PROCEDURE CalculateInvoiceFromTreatments(
    IN p_appointment_id INT,
    IN p_insurance_coverage DECIMAL(10,2),
    IN p_issued_date DATE,
    IN p_due_date DATE,
    IN p_initial_payment DECIMAL(10,2),
    OUT p_invoice_id INT
)
BEGIN
    DECLARE v_total_amount DECIMAL(10,2);
    DECLARE v_out_of_pocket DECIMAL(10,2);
    DECLARE v_due_amount DECIMAL(10,2);
    DECLARE v_status VARCHAR(20);

    -- Calculate total from treatments
    SELECT COALESCE(SUM(actual_price), 0) INTO v_total_amount
    FROM Appointment_Treatment
    WHERE appointment_id = p_appointment_id;

    -- If no treatments, use default consultation fee
    IF v_total_amount = 0 THEN
        SET v_total_amount = 80.00;
    END IF;

    -- Calculate out-of-pocket
    SET v_out_of_pocket = v_total_amount - COALESCE(p_insurance_coverage, 0);

    -- Calculate due amount
    SET v_due_amount = v_out_of_pocket - COALESCE(p_initial_payment, 0);

    -- Determine status
    IF v_due_amount <= 0 THEN
        SET v_status = 'Paid';
    ELSEIF p_initial_payment > 0 THEN
        SET v_status = 'Partially Paid';
    ELSE
        SET v_status = 'Pending';
    END IF;

    -- Create invoice
    INSERT INTO Invoice (
        appointment_id, total_amount, insurance_coverage,
        out_of_pocket_amount, due_amount, status, issued_date, due_date
    ) VALUES (
        p_appointment_id, v_total_amount, COALESCE(p_insurance_coverage, 0),
        v_out_of_pocket, v_due_amount, v_status, p_issued_date, p_due_date
    );

    SET p_invoice_id = LAST_INSERT_ID();

    -- Record initial payment if provided
    IF p_initial_payment > 0 THEN
        INSERT INTO Payment (invoice_id, paid_amount, payment_date, method_of_payment, status)
        VALUES (p_invoice_id, p_initial_payment, NOW(), 'Initial Payment', 'Completed');
    END IF;
END;

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- Branch-wise Appointment Summary
CREATE OR REPLACE VIEW vw_branch_appointment_summary AS
SELECT
    b.branch_id,
    b.name AS branch_name,
    DATE(a.schedule_date) AS appointment_date,
    COUNT(*) AS total_appointments,
    SUM(CASE WHEN a.status = 'Scheduled' THEN 1 ELSE 0 END) AS scheduled,
    SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN a.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled,
    SUM(CASE WHEN a.is_emergency = 1 THEN 1 ELSE 0 END) AS emergency
FROM Appointment a
JOIN Branch b ON a.branch_id = b.branch_id
GROUP BY b.branch_id, DATE(a.schedule_date);

-- Doctor-wise Revenue Report
CREATE OR REPLACE VIEW vw_doctor_revenue AS
SELECT
    d.doctor_id,
    s.name AS doctor_name,
    sp.name AS specialty,
    COUNT(DISTINCT a.appointment_id) AS total_appointments,
    SUM(i.total_amount) AS total_revenue,
    SUM(i.insurance_coverage) AS insurance_coverage,
    SUM(i.out_of_pocket_amount) AS out_of_pocket_revenue,
    SUM(i.due_amount) AS outstanding_balance
FROM Doctor d
JOIN Staff s ON d.staff_id = s.staff_id
LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
LEFT JOIN Specialties sp ON ds.specialty_id = sp.specialty_id
LEFT JOIN Appointment a ON d.doctor_id = a.doctor_id AND a.status = 'Completed'
LEFT JOIN Invoice i ON a.appointment_id = i.appointment_id
GROUP BY d.doctor_id, s.name, sp.name;

-- Patients with Outstanding Balances
CREATE OR REPLACE VIEW vw_patients_outstanding AS
SELECT
    p.patient_id,
    p.name AS patient_name,
    p.contact_info,
    COUNT(i.invoice_id) AS total_invoices,
    SUM(i.total_amount) AS total_billed,
    SUM(i.due_amount) AS total_outstanding,
    MAX(i.due_date) AS latest_due_date,
    CASE
        WHEN MAX(i.due_date) < CURDATE() THEN 'Overdue'
        ELSE 'Pending'
    END AS payment_status
FROM Patient p
JOIN Appointment a ON p.patient_id = a.patient_id
JOIN Invoice i ON a.appointment_id = i.appointment_id
WHERE i.due_amount > 0
GROUP BY p.patient_id, p.name, p.contact_info
HAVING total_outstanding > 0;

-- Treatment Statistics
CREATE OR REPLACE VIEW vw_treatment_statistics AS
SELECT
    tc.service_code,
    tc.name AS treatment_name,
    COUNT(at.appointment_id) AS times_performed,
    SUM(at.actual_price) AS total_revenue,
    AVG(at.actual_price) AS avg_price,
    DATE_FORMAT(a.schedule_date, '%Y-%m') AS month
FROM Treatment_Catalogue tc
LEFT JOIN Appointment_Treatment at ON tc.service_code = at.service_code
LEFT JOIN Appointment a ON at.appointment_id = a.appointment_id
WHERE a.status = 'Completed'
GROUP BY tc.service_code, DATE_FORMAT(a.schedule_date, '%Y-%m');

-- Insurance Coverage Analysis
CREATE OR REPLACE VIEW vw_insurance_analysis AS
SELECT
    ip.name AS insurance_provider,
    COUNT(DISTINCT p.patient_id) AS total_patients,
    COUNT(DISTINCT i.invoice_id) AS total_invoices,
    SUM(i.total_amount) AS total_billed,
    SUM(i.insurance_coverage) AS total_insurance_coverage,
    SUM(i.out_of_pocket_amount) AS total_out_of_pocket,
    ROUND(AVG(i.insurance_coverage / i.total_amount * 100), 2) AS avg_coverage_percent
FROM Insurance_Provider ip
LEFT JOIN Patient p ON ip.id = p.insurance_provider_id
LEFT JOIN Appointment a ON p.patient_id = a.patient_id
LEFT JOIN Invoice i ON a.appointment_id = i.appointment_id
WHERE i.invoice_id IS NOT NULL
GROUP BY ip.id, ip.name;

-- ============================================
-- SAMPLE DATA INSERTION
-- ============================================

-- Insert Roles
INSERT INTO Role (name, access_details) VALUES
('Admin', 'Full access to all system functionalities.'),
('Doctor', 'Access to patient records, appointments, and treatment modules.'),
('Receptionist', 'Access to appointments, patient registration, and billing modules.'),
('Branch Manager', 'Full access to branch-specific operations.');

-- Insert Insurance Providers
INSERT INTO Insurance_Provider (name, contact_number) VALUES
('MediLife Singapore', '68277988'),
('Prudential Assurance', '18003330333'),
('Great Eastern Life', '18002482888'),
('AIA Singapore', '18001248000'),
('NTUC Income', '67881777');

-- Insert Specialties
INSERT INTO Specialties (name, description) VALUES
('Cardiology', 'Deals with disorders of the heart and blood vessels.'),
('Dermatology', 'Deals with the skin, nails, and hair and its diseases.'),
('Pediatrics', 'The medical care of infants, children, and adolescents.'),
('Orthopedics', 'Deals with the correction of deformities of bones or muscles.'),
('Neurology', 'Deals with disorders of the nervous system.'),
('General Medicine', 'Primary care and general health issues.');

-- Insert Treatment Catalogue
INSERT INTO Treatment_Catalogue (service_code, name, description, price) VALUES
('CON-001', 'General Consultation', 'Standard doctor consultation', 80.00),
('LAB-001', 'Standard Blood Test', 'Complete blood count and basic metabolic panel', 150.50),
('XRAY-001', 'Chest X-Ray', 'Radiographic examination of chest', 120.00),
('DERM-001', 'Skin Allergy Test', 'Comprehensive allergy testing', 250.00),
('ECG-001', 'Electrocardiogram', 'Heart electrical activity monitoring', 200.00),
('ORTHO-001', 'Physical Therapy Session', 'Rehabilitation therapy', 100.00),
('LAB-002', 'Lipid Profile Test', 'Cholesterol and triglycerides test', 95.00),
('NEUR-001', 'Neurological Examination', 'Comprehensive nervous system check', 180.00),
('PED-001', 'Child Wellness Check', 'Pediatric health screening', 120.00),
('CARD-001', 'Stress Test', 'Cardiac stress testing', 350.00);

-- Insert Admin Account
INSERT INTO Account_Info (role_id, username, password_hash, email) VALUES
(1, 'lekshan', '$2b$10$xxoSo8xwOQoFzGjnb9O/oOaL8xCypg75Maam2YEgmZEcY7P6i0jly', 'llekshan@gmail.com');
-- Password: admin123

-- Insert Branch Managers Accounts
INSERT INTO Account_Info (role_id, username, password_hash, email) VALUES
(4, 'manager_colombo', '$2b$10$EluBmMMg7LYiCGcyl96ntuahvifrsraOPDiaAEhjiV5LMMPrWbo7G', 'manager.colombo@clinicpro.com'),
(4, 'manager_kandy', '$2b$10$EluBmMMg7LYiCGcyl96ntuahvifrsraOPDiaAEhjiV5LMMPrWbo7G', 'manager.kandy@clinicpro.com'),
(4, 'manager_galle', '$2b$10$EluBmMMg7LYiCGcyl96ntuahvifrsraOPDiaAEhjiV5LMMPrWbo7G', 'manager.galle@clinicpro.com');
-- Password: manager123

-- Insert Receptionist Accounts
INSERT INTO Account_Info (role_id, username, password_hash, email) VALUES
(3, 'reception_colombo', '$2b$10$aSEVJuHq8pScIrT0RfwrVexKN9TQ9ecrksHivDijLe21BwJVir1u6', 'reception.colombo@clinicpro.com'),
(3, 'reception_kandy', '$2b$10$aSEVJuHq8pScIrT0RfwrVexKN9TQ9ecrksHivDijLe21BwJVir1u6', 'reception.kandy@clinicpro.com'),
(3, 'reception_galle', '$2b$10$aSEVJuHq8pScIrT0RfwrVexKN9TQ9ecrksHivDijLe21BwJVir1u6', 'reception.galle@clinicpro.com');
-- Password: reception123

-- Insert Doctor Accounts
INSERT INTO Account_Info (role_id, username, password_hash, email) VALUES
(2, 'dr.silva', '$2b$10$z3EZX/jcU700XLv151.0DuiMdBPEqOBqYdHSAEizwJYX6zx6SBjL6', 'dr.silva@clinicpro.com'),
(2, 'dr.fernando', '$2b$10$z3EZX/jcU700XLv151.0DuiMdBPEqOBqYdHSAEizwJYX6zx6SBjL6', 'dr.fernando@clinicpro.com'),
(2, 'dr.perera', '$2b$10$z3EZX/jcU700XLv151.0DuiMdBPEqOBqYdHSAEizwJYX6zx6SBjL6', 'dr.perera@clinicpro.com'),
(2, 'dr.rajapakse', '$2b$10$z3EZX/jcU700XLv151.0DuiMdBPEqOBqYdHSAEizwJYX6zx6SBjL6', 'dr.rajapakse@clinicpro.com'),
(2, 'dr.jayawardena', '$2b$10$z3EZX/jcU700XLv151.0DuiMdBPEqOBqYdHSAEizwJYX6zx6SBjL6', 'dr.jayawardena@clinicpro.com'),
(2, 'dr.wickramasinghe', '$2b$10$z3EZX/jcU700XLv151.0DuiMdBPEqOBqYdHSAEizwJYX6zx6SBjL6', 'dr.wickramasinghe@clinicpro.com');
-- Password: doctor123

-- Create temporary branches without managers (will update after staff created)
INSERT INTO Branch (name, contact_number, address, manager_user_id) VALUES
('MedSync Colombo', '0112345678', '123 Galle Road, Colombo 03, Sri Lanka', NULL),
('MedSync Kandy', '0812234567', '456 Peradeniya Road, Kandy, Sri Lanka', NULL),
('MedSync Galle', '0912345678', '789 Matara Road, Galle, Sri Lanka', NULL);

-- Insert Staff (Managers)
INSERT INTO Staff (user_id, name, contact_info, is_medical_staff, branch_id) VALUES
(2, 'Nimal Perera', '0771234567', FALSE, 1),  -- Colombo Manager
(3, 'Sunil Wickramasinghe', '0772234567', FALSE, 2),  -- Kandy Manager
(4, 'Kamal Silva', '0773234567', FALSE, 3);  -- Galle Manager

-- Update branches with manager IDs
UPDATE Branch SET manager_user_id = 2 WHERE branch_id = 1;
UPDATE Branch SET manager_user_id = 3 WHERE branch_id = 2;
UPDATE Branch SET manager_user_id = 4 WHERE branch_id = 3;

-- Insert Staff (Receptionists)
INSERT INTO Staff (user_id, name, contact_info, is_medical_staff, branch_id) VALUES
(5, 'Shalini Fernando', '0774234567', FALSE, 1),
(6, 'Dilini Rajapakse', '0775234567', FALSE, 2),
(7, 'Amaya Jayawardena', '0776234567', FALSE, 3);

-- Insert Staff (Doctors)
INSERT INTO Staff (user_id, name, contact_info, is_medical_staff, branch_id) VALUES
(8, 'Dr. Arjuna Silva', '0777234567', TRUE, 1),
(9, 'Dr. Priyanka Fernando', '0778234567', TRUE, 1),
(10, 'Dr. Rohan Perera', '0779234567', TRUE, 2),
(11, 'Dr. Samantha Rajapakse', '0770234567', TRUE, 2),
(12, 'Dr. Dinesh Jayawardena', '0771134567', TRUE, 3),
(13, 'Dr. Nimali Wickramasinghe', '0772134567', TRUE, 3);

-- Insert Doctors
-- Corrected to reference only staff members who are doctors (staff_id 7 through 12)
INSERT INTO Doctor (staff_id) VALUES
(7), (8), (9), (10), (11), (12);

-- Assign Doctor Specialties
INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES
(1, 1),  -- Dr. Silva - Cardiology
(1, 6),  -- Dr. Silva - General Medicine
(2, 2),  -- Dr. Fernando - Dermatology
(3, 3),  -- Dr. Perera - Pediatrics
(3, 6),  -- Dr. Perera - General Medicine
(4, 4),  -- Dr. Rajapakse - Orthopedics
(5, 5),  -- Dr. Jayawardena - Neurology
(6, 6);  -- Dr. Wickramasinghe - General Medicine

-- Insert Patients
INSERT INTO Patient (name, gender, date_of_birth, contact_info, emergency_contact, insurance_provider_id, policy_number) VALUES
('Anura Dissanayake', 'Male', '1985-03-15', '0771234001', '0771234002', 1, 'ML-2024-001'),
('Sanduni Perera', 'Female', '1990-07-22', '0772234001', '0772234002', 2, 'PA-2024-102'),
('Kasun Wickramaratne', 'Male', '1978-11-30', '0773234001', '0773234002', 3, 'GE-2024-203'),
('Dilini Jayasinghe', 'Female', '1995-05-18', '0774234001', '0774234002', 1, 'ML-2024-304'),
('Ranil Fernando', 'Male', '1982-09-25', '0775234001', '0775234002', NULL, NULL),
('Malini Gunawardena', 'Female', '1988-12-10', '0776234001', '0776234002', 4, 'AIA-2024-405'),
('Chaminda Silva', 'Male', '1975-04-08', '0777234001', '0777234002', 2, 'PA-2024-506'),
('Nadeeka Rajapakse', 'Female', '1993-08-14', '0778234001', '0778234002', NULL, NULL),
('Prasanna Mendis', 'Male', '1980-01-20', '0779234001', '0779234002', 5, 'NI-2024-607'),
('Kumari De Silva', 'Female', '1987-06-28', '0770234001', '0770234002', 3, 'GE-2024-708'),
('Lasith Bandara', 'Male', '2010-03-12', '0771334001', '0771334002', 1, 'ML-2024-809'),
('Amaya Wijesinghe', 'Female', '2015-09-05', '0772334001', '0772334002', 2, 'PA-2024-910'),
('Tharanga Jayawardena', 'Male', '1992-11-18', '0773334001', '0773334002', NULL, NULL),
('Shani Fernando', 'Female', '1986-02-24', '0774334001', '0774334002', 4, 'AIA-2024-011'),
('Buddhika Perera', 'Male', '1979-07-16', '0775334001', '0775334002', 5, 'NI-2024-112');

-- Insert Appointments (Mix of past and future)
INSERT INTO Appointment (patient_id, doctor_id, branch_id, schedule_date, status, is_emergency, consultation_notes) VALUES
-- Completed appointments with notes
(1, 1, 1, '2025-01-10 09:00:00', 'Completed', FALSE, 'Patient complained of chest pain. ECG performed. Results normal. Advised stress management.'),
(2, 2, 1, '2025-01-10 10:00:00', 'Completed', FALSE, 'Skin rash on arms. Prescribed topical cream. Follow-up in 2 weeks.'),
(3, 3, 2, '2025-01-11 09:30:00', 'Completed', FALSE, 'Child wellness check. All vitals normal. Vaccines up to date.'),
(4, 1, 1, '2025-01-11 14:00:00', 'Completed', FALSE, 'Follow-up for hypertension. Blood pressure under control. Continue medication.'),
(5, 4, 2, '2025-01-12 10:00:00', 'Completed', FALSE, 'Knee pain after sports injury. X-Ray ordered. Prescribed pain relief.'),
(6, 5, 3, '2025-01-13 11:00:00', 'Completed', FALSE, 'Patient reports frequent headaches. Neurological exam normal. Suspect migraine.'),
(7, 2, 1, '2025-01-14 09:00:00', 'Completed', TRUE, 'Severe allergic reaction. Stabilized and provided antihistamines.'),
(8, 6, 3, '2025-01-15 10:30:00', 'Completed', FALSE, 'General check-up. Advised on diet and exercise.'),
(9, 3, 2, '2025-01-16 11:00:00', 'Completed', FALSE, 'Annual pediatric check-up. Growth normal.'),
(10, 3, 2, '2025-01-17 09:00:00', 'Completed', FALSE, 'Fever and cough. Diagnosed with mild flu.'),
(4, 1, 1, '2025-01-18 10:00:00', 'Cancelled', FALSE, 'Patient called to cancel.'),
(5, 4, 2, '2025-01-19 11:00:00', 'Completed', FALSE, 'Follow-up on knee injury. Referred for physical therapy.'),
(6, 5, 3, '2025-01-20 14:00:00', 'Completed', FALSE, 'Headache follow-up. Medication adjusted.'),
-- Future scheduled appointments (relative to 2025-10-18)
(1, 1, 1, '2025-10-20 10:00:00', 'Scheduled', FALSE, NULL),
(2, 2, 1, '2025-10-21 11:00:00', 'Scheduled', FALSE, NULL),
(3, 3, 2, '2025-10-22 09:30:00', 'Scheduled', FALSE, NULL),
(13, 6, 3, '2025-10-23 14:00:00', 'Scheduled', FALSE, NULL),
(14, 5, 3, '2025-10-24 15:00:00', 'Scheduled', FALSE, NULL),
(15, 4, 2, '2025-10-25 10:00:00', 'Scheduled', FALSE, NULL),
-- An appointment to be rescheduled
(8, 6, 3, '2025-10-26 10:00:00', 'Scheduled', FALSE, NULL);

-- Insert Rescheduled Appointment Log
-- This logs the change for appointment_id 20 (Nadeeka Rajapakse)
INSERT INTO rescheduled_appointments (previous_appointment_id, previous_date, new_date, rescheduled_by_staff_id, reschedule_reason)
VALUES (20, '2025-10-26 10:00:00', '2025-10-28 09:00:00', 6, 'Patient request due to work conflict.');

-- Update the appointment to reflect the reschedule
UPDATE Appointment
SET schedule_date = '2025-10-28 09:00:00',
    status = 'Rescheduled',
    reschedule_id = LAST_INSERT_ID()
WHERE appointment_id = 20;


-- Insert Appointment Treatments (for completed appointments)
INSERT INTO Appointment_Treatment (appointment_id, service_code, notes, actual_price) VALUES
-- Appt 1 (Anura)
(1, 'CON-001', 'Standard consultation', 80.00),
(1, 'ECG-001', 'ECG performed due to chest pain', 200.00),
-- Appt 2 (Sanduni)
(2, 'CON-001', 'Dermatology consultation', 80.00),
(2, 'DERM-001', 'Allergy test administered', 250.00),
-- Appt 3 (Kasun)
(3, 'PED-001', 'Standard wellness check', 120.00),
-- Appt 4 (Dilini)
(4, 'CON-001', 'Follow-up consultation', 80.00),
(4, 'LAB-002', 'Lipid profile check', 95.00),
-- Appt 5 (Ranil)
(5, 'CON-001', 'Ortho consultation', 80.00),
(5, 'XRAY-001', 'Right knee X-Ray', 120.00),
-- Appt 6 (Malini)
(6, 'CON-001', 'Neurology consultation', 80.00),
(6, 'NEUR-001', 'Initial neurological exam', 180.00),
-- Appt 7 (Chaminda)
(7, 'CON-001', 'Emergency consultation', 80.00),
-- Appt 8 (Nadeeka)
(8, 'CON-001', 'General consultation', 80.00),
(8, 'LAB-001', 'Standard bloodwork', 150.50),
-- Appt 9 (Lasith)
(9, 'PED-001', 'Pediatric check-up', 120.00),
-- Appt 10 (Amaya)
(10, 'PED-001', 'Pediatric consultation for flu', 120.00),
-- Appt 12 (Ranil)
(12, 'CON-001', 'Follow-up ortho consultation', 80.00),
(12, 'ORTHO-001', 'First physical therapy session', 100.00),
-- Appt 13 (Malini)
(13, 'CON-001', 'Neurology follow-up', 80.00);


-- Insert Invoices (using the stored procedure)
SET @inv_id = 0;

-- Appt 1 (Anura, Insured, Unpaid) - Total 280
CALL CalculateInvoiceFromTreatments(1, 200.00, '2025-01-10', '2025-02-10', 0, @inv_id);
-- Appt 2 (Sanduni, Insured, Paid) - Total 330
CALL CalculateInvoiceFromTreatments(2, 300.00, '2025-01-10', '2025-02-10', 30.00, @inv_id);
-- Appt 3 (Kasun, Insured, Unpaid) - Total 120
CALL CalculateInvoiceFromTreatments(3, 100.00, '2025-01-11', '2025-02-11', 0, @inv_id);
-- Appt 4 (Dilini, Insured, Paid) - Total 175
CALL CalculateInvoiceFromTreatments(4, 150.00, '2025-01-11', '2025-02-11', 25.00, @inv_id);
-- Appt 5 (Ranil, No Ins, Partially Paid) - Total 200
CALL CalculateInvoiceFromTreatments(5, 0.00, '2025-01-12', '2025-02-12', 100.00, @inv_id);
-- Appt 6 (Malini, Insured, Unpaid) - Total 260
CALL CalculateInvoiceFromTreatments(6, 200.00, '2025-01-13', '2025-02-13', 0, @inv_id);
-- Appt 7 (Chaminda, Insured, Paid) - Total 80
CALL CalculateInvoiceFromTreatments(7, 50.00, '2025-01-14', '2025-02-14', 30.00, @inv_id);
-- Appt 8 (Nadeeka, No Ins, Unpaid) - Total 230.50
CALL CalculateInvoiceFromTreatments(8, 0.00, '2025-01-15', '2025-02-15', 0, @inv_id);
-- Appt 9 (Lasith, Insured, Paid) - Total 120
CALL CalculateInvoiceFromTreatments(9, 100.00, '2025-01-16', '2025-02-16', 20.00, @inv_id);
-- Appt 10 (Amaya, Insured, Unpaid) - Total 120
CALL CalculateInvoiceFromTreatments(10, 100.00, '2025-01-17', '2025-02-17', 0, @inv_id);
-- Appt 12 (Ranil, No Ins, Unpaid) - Total 180
CALL CalculateInvoiceFromTreatments(12, 0.00, '2025-01-19', '2025-02-19', 0, @inv_id);
-- Appt 13 (Malini, Insured, Unpaid) - Total 80
CALL CalculateInvoiceFromTreatments(13, 50.00, '2025-01-20', '2025-02-20', 0, @inv_id);


-- Insert Payments (subsequent payments, triggers will update invoice status)
-- Invoice 1 (Anura) - Due 80. Pays in full.
INSERT INTO Payment (invoice_id, paid_amount, payment_date, method_of_payment, status)
VALUES (1, 80.00, '2025-02-05 10:00:00', 'Credit Card', 'Completed');

-- Invoice 3 (Kasun) - Due 20. Pays in full.
INSERT INTO Payment (invoice_id, paid_amount, payment_date, method_of_payment, status)
VALUES (3, 20.00, '2025-02-11 14:00:00', 'Credit Card', 'Completed');

-- Invoice 5 (Ranil) - Due 100. Pays 50. (Will remain 'Partially Paid')
INSERT INTO Payment (invoice_id, paid_amount, payment_date, method_of_payment, status)
VALUES (5, 50.00, '2025-02-10 11:00:00', 'Cash', 'Completed');

-- Invoice 6 (Malini) - Due 60. Pays in full.
INSERT INTO Payment (invoice_id, paid_amount, payment_date, method_of_payment, status)
VALUES (6, 60.00, '2025-02-11 12:00:00', 'Bank Transfer', 'Completed');

-- Invoice 10 (Amaya) - Due 20. Pays in full.
INSERT INTO Payment (invoice_id, paid_amount, payment_date, method_of_payment, status)
VALUES (10, 20.00, '2025-02-15 15:00:00', 'Cash', 'Completed');


-- Insert Insurance Claims
INSERT INTO Insurance_Claim (invoice_id, insurance_provider_id, claimed_amount, claim_status) VALUES
-- Appt 1 (Anura, Ins ID 1)
(1, 1, 200.00, 'Approved'),
-- Appt 2 (Sanduni, Ins ID 2)
(2, 2, 300.00, 'Approved'),
-- Appt 3 (Kasun, Ins ID 3)
(3, 3, 100.00, 'Approved'),
-- Appt 4 (Dilini, Ins ID 1)
(4, 1, 150.00, 'Approved'),
-- Appt 6 (Malini, Ins ID 4)
(6, 4, 200.00, 'Pending'),
-- Appt 7 (Chaminda, Ins ID 2)
(7, 2, 50.00, 'Rejected'),
-- Appt 9 (Lasith, Ins ID 1)
(9, 1, 100.00, 'Approved'),
-- Appt 10 (Amaya, Ins ID 2)
(10, 2, 100.00, 'Pending'),
-- Appt 13 (Malini, Ins ID 4)
(12, 4, 50.00, 'Approved');

-- ============================================
-- END OF SCRIPT
-- ============================================

COMMIT;

