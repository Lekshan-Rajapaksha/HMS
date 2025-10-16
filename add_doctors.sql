-- Add 2 New Doctors to the System
-- Run this SQL script in MySQL

-- First, let's check what role_id is for Doctor and get available branches
-- SELECT role_id FROM Role WHERE name = 'Doctor';
-- SELECT branch_id, name FROM Branch;

-- Assuming Doctor role_id = 2 (adjust if different)
-- Assuming we have branches with IDs 1, 2, 3

-- ===== DOCTOR 1: Dr. Sarah Johnson (General Medicine) =====

-- 1. Create account for Dr. Sarah Johnson
INSERT INTO Account_Info (role_id, username, password_hash, email) 
VALUES (
    2, 
    'dr.sarah', 
    '$2b$10$YourHashedPasswordHere1', -- Password: doctor123
    'sarah.johnson@clinicpro.com'
);

-- Get the user_id that was just created
SET @user_id_1 = LAST_INSERT_ID();

-- 2. Create staff record
INSERT INTO Staff (user_id, name, contact_info, is_medical_staff, branch_id) 
VALUES (
    @user_id_1, 
    'Dr. Sarah Johnson', 
    '0771234567', 
    1, -- is_medical_staff = true
    1  -- branch_id (adjust to your branch)
);

-- Get the staff_id
SET @staff_id_1 = LAST_INSERT_ID();

-- 3. Create doctor record
INSERT INTO Doctor (staff_id) 
VALUES (@staff_id_1);

-- Get the doctor_id
SET @doctor_id_1 = LAST_INSERT_ID();

-- 4. Assign specialty (General Medicine - assuming specialty_id = 1)
INSERT INTO doctor_specialties (doctor_id, specialty_id) 
VALUES (@doctor_id_1, 1);


-- ===== DOCTOR 2: Dr. Michael Chen (ENT Specialist) =====

-- 1. Create account for Dr. Michael Chen
INSERT INTO Account_Info (role_id, username, password_hash, email) 
VALUES (
    2, 
    'dr.michael', 
    '$2b$10$YourHashedPasswordHere2', -- Password: doctor456
    'michael.chen@clinicpro.com'
);

SET @user_id_2 = LAST_INSERT_ID();

-- 2. Create staff record
INSERT INTO Staff (user_id, name, contact_info, is_medical_staff, branch_id) 
VALUES (
    @user_id_2, 
    'Dr. Michael Chen', 
    '0779876543', 
    1, 
    2  -- different branch
);

SET @staff_id_2 = LAST_INSERT_ID();

-- 3. Create doctor record
INSERT INTO Doctor (staff_id) 
VALUES (@staff_id_2);

SET @doctor_id_2 = LAST_INSERT_ID();

-- 4. Assign specialty (ENT - assuming specialty_id = 2)
INSERT INTO doctor_specialties (doctor_id, specialty_id) 
VALUES (@doctor_id_2, 2);


-- ===== VERIFY THE ADDITIONS =====
SELECT 
    ai.username, 
    s.name, 
    s.contact_info, 
    b.name as branch_name,
    sp.name as specialty
FROM Account_Info ai
JOIN Staff s ON ai.user_id = s.user_id
JOIN Doctor d ON s.staff_id = d.staff_id
LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
LEFT JOIN Specialties sp ON ds.specialty_id = sp.specialty_id
LEFT JOIN Branch b ON s.branch_id = b.branch_id
WHERE ai.username IN ('dr.sarah', 'dr.michael');
