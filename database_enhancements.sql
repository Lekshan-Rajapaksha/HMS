-- =====================================================================
-- DATABASE ENHANCEMENTS FOR HMS
-- Features: Walk-in Appointments, Payment Method Tracking, Cancellation Reasons
-- =====================================================================

-- 1. ADD WALK-IN FLAG TO APPOINTMENT TABLE
-- This allows tracking of emergency walk-in appointments vs pre-booked appointments
ALTER TABLE Appointment 
ADD COLUMN is_walk_in BOOLEAN DEFAULT FALSE COMMENT 'TRUE if this is an emergency walk-in appointment';

-- 2. ADD CANCELLATION REASON TO APPOINTMENT TABLE
-- Track why appointments are cancelled for better analytics
ALTER TABLE Appointment 
ADD COLUMN cancellation_reason VARCHAR(500) NULL COMMENT 'Reason for cancellation if status is Cancelled';

-- 3. ADD CANCELLED BY STAFF TRACKING
-- Track which staff member cancelled the appointment
ALTER TABLE Appointment 
ADD COLUMN cancelled_by_staff_id INT NULL COMMENT 'Staff ID who cancelled the appointment';

-- 4. ADD CANCELLED DATE TRACKING
-- Track when the appointment was cancelled
ALTER TABLE Appointment 
ADD COLUMN cancelled_date DATETIME NULL COMMENT 'Date and time when appointment was cancelled';

-- 5. ADD FOREIGN KEY FOR CANCELLED BY STAFF
ALTER TABLE Appointment 
ADD CONSTRAINT fk_cancelled_by_staff 
FOREIGN KEY (cancelled_by_staff_id) REFERENCES Staff(staff_id) ON DELETE SET NULL;

-- 6. VERIFY PAYMENT TABLE HAS METHOD_OF_PAYMENT
-- (This should already exist based on the code, but let's ensure it)
-- If it doesn't exist, uncomment the following:
-- ALTER TABLE Payment 
-- ADD COLUMN method_of_payment VARCHAR(50) NOT NULL DEFAULT 'Cash' 
-- COMMENT 'Payment method: Cash, Card, Online, Insurance';

-- 7. CREATE INDEX FOR WALK-IN APPOINTMENTS (for faster queries)
CREATE INDEX idx_walk_in ON Appointment(is_walk_in);

-- 8. CREATE INDEX FOR CANCELLED APPOINTMENTS
CREATE INDEX idx_cancelled ON Appointment(status, cancelled_date);

-- 9. CREATE INDEX FOR PAYMENT METHOD (for reporting)
CREATE INDEX idx_payment_method ON Payment(method_of_payment);

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Check the updated Appointment table structure
DESCRIBE Appointment;

-- Check the Payment table structure
DESCRIBE Payment;

-- Sample query to get walk-in appointments
-- SELECT * FROM Appointment WHERE is_walk_in = TRUE;

-- Sample query to get cancelled appointments with reasons
-- SELECT 
--     a.appointment_id,
--     p.name as patient_name,
--     a.cancellation_reason,
--     s.name as cancelled_by,
--     a.cancelled_date
-- FROM Appointment a
-- JOIN Patient p ON a.patient_id = p.patient_id
-- LEFT JOIN Staff s ON a.cancelled_by_staff_id = s.staff_id
-- WHERE a.status = 'Cancelled';
