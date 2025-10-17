-- ============================================================================
-- HMS (Hospital Management System) - BASE SCHEMA
-- ============================================================================
-- This file creates the initial database structure for the HMS system
-- Run this BEFORE running any migration files
-- ============================================================================

-- Drop existing tables if they exist (for clean installation)
DROP TABLE IF EXISTS data_access_log;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS doctor_unavailability;
DROP TABLE IF EXISTS Appointment_Treatment;
DROP TABLE IF EXISTS Payment;
DROP TABLE IF EXISTS Invoice;
DROP TABLE IF EXISTS Appointment;
DROP TABLE IF EXISTS rescheduled_appointments;
DROP TABLE IF EXISTS doctor_specialties;
DROP TABLE IF EXISTS Doctor;
DROP TABLE IF EXISTS Staff;
DROP TABLE IF EXISTS Branch;
DROP TABLE IF EXISTS Patient;
DROP TABLE IF EXISTS Treatment_Catalogue;
DROP TABLE IF EXISTS Insurance_Provider;
DROP TABLE IF EXISTS Specialties;
DROP TABLE IF EXISTS Account_Info;
DROP TABLE IF EXISTS Role;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Role Table
CREATE TABLE Role (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Account_Info Table
CREATE TABLE Account_Info (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (role_id) REFERENCES Role(role_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Branch Table
CREATE TABLE Branch (
    branch_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    contact_number VARCHAR(20),
    manager_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (manager_user_id) REFERENCES Account_Info(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Staff Table
CREATE TABLE Staff (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    contact_info VARCHAR(255),
    is_medical_staff BOOLEAN DEFAULT FALSE,
    branch_id INT,
    hire_date DATE DEFAULT (CURRENT_DATE),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Account_Info(user_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Specialties Table
CREATE TABLE Specialties (
    specialty_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Doctor Table
CREATE TABLE Doctor (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL UNIQUE,
    license_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES Staff(staff_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Doctor Specialties Junction Table
CREATE TABLE doctor_specialties (
    doctor_id INT NOT NULL,
    specialty_id INT NOT NULL,
    PRIMARY KEY (doctor_id, specialty_id),
    FOREIGN KEY (doctor_id) REFERENCES Doctor(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (specialty_id) REFERENCES Specialties(specialty_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insurance_Provider Table
CREATE TABLE Insurance_Provider (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    contact_info TEXT,
    policy_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Patient Table
CREATE TABLE Patient (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    contact_info VARCHAR(255),
    address TEXT,
    emergency_contact VARCHAR(255),
    insurance_provider_id INT,
    insurance_policy_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (insurance_provider_id) REFERENCES Insurance_Provider(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Appointment Table
CREATE TABLE Appointment (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    branch_id INT NOT NULL,
    schedule_date DATETIME NOT NULL,
    status ENUM('Scheduled', 'Completed', 'Canceled', 'Rescheduled', 'No-Show') DEFAULT 'Scheduled',
    is_emergency BOOLEAN DEFAULT FALSE,
    reschedule_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES Doctor(doctor_id) ON DELETE RESTRICT,
    FOREIGN KEY (branch_id) REFERENCES Branch(branch_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rescheduled Appointments Log Table
CREATE TABLE rescheduled_appointments (
    reschedule_id INT AUTO_INCREMENT PRIMARY KEY,
    previous_appointment_id INT NOT NULL,
    previous_date DATETIME NOT NULL,
    new_date DATETIME NOT NULL,
    rescheduled_by_staff_id INT NOT NULL,
    reschedule_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (previous_appointment_id) REFERENCES Appointment(appointment_id) ON DELETE CASCADE,
    FOREIGN KEY (rescheduled_by_staff_id) REFERENCES Staff(staff_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Treatment_Catalogue Table
CREATE TABLE Treatment_Catalogue (
    service_code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Appointment_Treatment Junction Table
CREATE TABLE Appointment_Treatment (
    appointment_id INT NOT NULL,
    service_code VARCHAR(50) NOT NULL,
    quantity INT DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (appointment_id, service_code),
    FOREIGN KEY (appointment_id) REFERENCES Appointment(appointment_id) ON DELETE CASCADE,
    FOREIGN KEY (service_code) REFERENCES Treatment_Catalogue(service_code) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Invoice Table
CREATE TABLE Invoice (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL UNIQUE,
    total_amount DECIMAL(10, 2) NOT NULL,
    insurance_coverage DECIMAL(10, 2) DEFAULT 0.00,
    out_of_pocket_amount DECIMAL(10, 2) NOT NULL,
    due_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('Pending', 'Partially Paid', 'Paid', 'Overdue') DEFAULT 'Pending',
    issued_date DATE NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES Appointment(appointment_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payment Table
CREATE TABLE Payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    paid_amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    method_of_payment VARCHAR(50) NOT NULL,
    status ENUM('Pending', 'Completed', 'Failed', 'Refunded') DEFAULT 'Completed',
    transaction_reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES Invoice(invoice_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert default roles
INSERT INTO Role (name, description) VALUES
('Admin', 'System administrator with full access'),
('Doctor', 'Medical professional providing patient care'),
('Receptionist', 'Front desk staff managing appointments and patients'),
('Branch Manager', 'Manager overseeing branch operations');

-- Insert default specialties
INSERT INTO Specialties (name, description) VALUES
('General Practice', 'General medical care'),
('Cardiology', 'Heart and cardiovascular system'),
('Dermatology', 'Skin, hair, and nails'),
('Pediatrics', 'Medical care for children'),
('Orthopedics', 'Musculoskeletal system'),
('Neurology', 'Nervous system'),
('Psychiatry', 'Mental health'),
('Radiology', 'Medical imaging'),
('Surgery', 'Surgical procedures'),
('Emergency Medicine', 'Acute medical care');

-- Insert default insurance providers
INSERT INTO Insurance_Provider (name, contact_info) VALUES
('National Health Insurance', 'contact@nhi.gov'),
('Private Health Care', 'info@privatehc.com'),
('Employee Health Plan', 'support@employeehp.com'),
('Self-Pay', 'No insurance - direct payment');

-- Insert default treatment catalogue
INSERT INTO Treatment_Catalogue (service_code, name, description, base_price, category) VALUES
('CONS-GEN', 'General Consultation', 'Basic medical consultation', 50.00, 'Consultation'),
('CONS-SPEC', 'Specialist Consultation', 'Consultation with a specialist', 100.00, 'Consultation'),
('XRAY-CHE', 'Chest X-Ray', 'Chest radiography', 75.00, 'Imaging'),
('BLOOD-CBC', 'Complete Blood Count', 'Full blood analysis', 30.00, 'Laboratory'),
('ECG-STD', 'Standard ECG', 'Electrocardiogram test', 40.00, 'Diagnostics'),
('VACC-FLU', 'Flu Vaccination', 'Annual flu shot', 25.00, 'Preventive'),
('DRESS-MIN', 'Minor Wound Dressing', 'Basic wound care', 20.00, 'Procedure'),
('SURG-MIN', 'Minor Surgery', 'Small surgical procedure', 500.00, 'Surgery');

-- Insert default admin user (username: admin, password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO Account_Info (role_id, username, password_hash, email) VALUES
(1, 'admin', '$2a$10$8K1p/a0dL3.JbNWnZQxDwef6PqEPq5Ql9qPxvH.NYgXxgDhHzG7Oy', 'admin@hms.com');

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_patient_name ON Patient(name);
CREATE INDEX idx_appointment_date ON Appointment(schedule_date);
CREATE INDEX idx_appointment_status ON Appointment(status);
CREATE INDEX idx_appointment_patient ON Appointment(patient_id);
CREATE INDEX idx_appointment_doctor ON Appointment(doctor_id);
CREATE INDEX idx_appointment_branch ON Appointment(branch_id);
CREATE INDEX idx_invoice_status ON Invoice(status);
CREATE INDEX idx_invoice_due_date ON Invoice(due_date);
CREATE INDEX idx_payment_date ON Payment(payment_date);
CREATE INDEX idx_staff_branch ON Staff(branch_id);

-- ============================================================================
-- END OF BASE SCHEMA
-- ============================================================================
