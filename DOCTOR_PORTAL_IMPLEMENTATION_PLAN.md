# Doctor Portal Implementation Plan for CATMS
## Hospital Management System - MedSync Clinic

**Document Version:** 1.0
**Date:** 2025-10-18
**System:** Clinic Appointment and Treatment Management System (CATMS)

---

## Executive Summary

This document provides a comprehensive, phase-based implementation plan for building the Doctor Portal component of the CATMS system. The plan is organized into 6 major phases with clear milestones, deliverables, and testing criteria to ensure compliance with all functional, security, and regulatory requirements.

### Current System State Analysis

**✅ What Exists:**
- Database schema with 16 tables (role, account_info, staff, doctor, patient, appointment, etc.)
- Backend API (Express.js + MySQL) with JWT authentication
- 10 existing doctor-specific API endpoints:
  - `/api/doctor/profile` - Get doctor profile
  - `/api/doctor/appointments/today` - Today's appointments
  - `/api/doctor/appointments/upcoming` - Upcoming appointments
  - `/api/doctor/appointments/search` - Search appointments with filters
  - `/api/doctor/appointments/:appointmentId/status` - Update appointment status
  - `/api/doctor/stats` - Dashboard statistics
  - `/api/doctor/patients/:patientId` - Patient details
  - `/api/doctor/patients/:patientId/history` - Patient appointment history
- Frontend: HTML/CSS/Bootstrap doctor-portal.html with glassmorphic design
- 16 existing user accounts (5 admins, 6 doctors, 2 receptionists, 3 branch managers)
- Audit log tables (audit_log, data_access_log) exist but not integrated
- Database triggers for business logic (PreventDoctorDeletionWithAppointments, UpdateInvoiceStatusAfterPayment)

**❌ What's Missing (Critical Requirements):**
1. **Clinical Documentation System (PRIMARY FEATURE):**
   - Treatment recording interface (can only add to completed appointments)
   - Treatment catalogue selection from database
   - Consultation notes with auto-save functionality
   - Medical history fields in UI (allergies, current medications)

2. **Security & Compliance:**
   - Audit logging integration for all doctor actions
   - Session timeout implementation
   - Multi-factor authentication (MFA)
   - Data access logging for PDPA compliance

3. **Reports:**
   - Doctor-wise revenue report
   - Treatments per category report
   - Appointment summary reports with date filters

4. **UI/UX Enhancements:**
   - Auto-save for consultation notes (every 30 seconds)
   - Calendar view for appointments
   - Field-level access control
   - Error recovery mechanisms
   - Input validation with contextual help

---

## Phase-Based Implementation Plan

---

## PHASE 1: Database Schema Enhancements & Security Foundation
**Duration:** 3-4 days
**Priority:** CRITICAL
**Dependencies:** None

### Objectives
- Ensure database schema supports all required features
- Add missing columns for clinical documentation
- Implement audit logging infrastructure
- Set up session management

### Tasks

#### 1.1 Database Schema Updates
**File:** `backend/migrations/clinical_documentation_migration.sql`

```sql
-- Add consultation notes to Appointment table (if missing)
ALTER TABLE appointment
ADD COLUMN IF NOT EXISTS consultation_notes TEXT COMMENT 'Doctor consultation notes';

-- Add medical history fields to Patient table (if missing)
ALTER TABLE patient
ADD COLUMN IF NOT EXISTS medical_history TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT;

-- Update appointment_treatment table to match requirements
-- Ensure it has: appointment_id, service_code, notes, actual_price

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_status_doctor
  ON appointment(doctor_id, status, schedule_date);
CREATE INDEX IF NOT EXISTS idx_patient_search
  ON patient(name, contact_info);

-- Add session management table
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
  INDEX idx_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Testing Criteria:**
- [ ] Run migration successfully without errors
- [ ] Verify `consultation_notes` column exists in appointment table
- [ ] Verify medical history fields in patient table
- [ ] Verify user_sessions table created
- [ ] Check all indexes are created: `SHOW INDEX FROM appointment;`
- [ ] Test constraint: Try inserting appointment_treatment for non-completed appointment (should fail)

**SQL Test Commands:**
```sql
-- Verify schema changes
DESCRIBE appointment;
DESCRIBE patient;
DESCRIBE appointment_treatment;
DESCRIBE user_sessions;

-- Test data insertion
INSERT INTO user_sessions (session_id, user_id, token, expires_at, ip_address)
VALUES ('test-session-123', 2, 'test-token', DATE_ADD(NOW(), INTERVAL 30 MINUTE), '127.0.0.1');
SELECT * FROM user_sessions WHERE session_id = 'test-session-123';
DELETE FROM user_sessions WHERE session_id = 'test-session-123';
```

#### 1.2 Audit Logging Integration
**File:** `backend/middleware/auditLogger.js`

```javascript
// Middleware to log all doctor actions to audit_log table
const auditLogger = async (req, res, next) => {
  const originalSend = res.send;
  const startTime = Date.now();

  res.send = function (data) {
    const responseTime = Date.now() - startTime;

    // Log to audit_log table
    if (req.user && req.method !== 'GET') {
      const logEntry = {
        user_id: req.user.userId,
        action: `${req.method} ${req.path}`,
        table_name: extractTableFromPath(req.path),
        record_id: req.params.id || req.params.appointmentId || req.params.patientId || null,
        old_value: req.originalBody ? JSON.stringify(req.originalBody) : null,
        new_value: req.body ? JSON.stringify(req.body) : null,
        ip_address: req.ip,
        timestamp: new Date()
      };

      // Async insert (non-blocking)
      insertAuditLog(logEntry).catch(err => console.error('Audit log error:', err));
    }

    // Log data access for GET requests to patient data
    if (req.user && req.method === 'GET' && req.path.includes('patient')) {
      const accessLog = {
        user_id: req.user.userId,
        patient_id: req.params.patientId || null,
        action: 'VIEW',
        endpoint: req.path,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      };

      insertDataAccessLog(accessLog).catch(err => console.error('Access log error:', err));
    }

    originalSend.call(this, data);
  };

  next();
};

async function insertAuditLog(logEntry) {
  const pool = require('../server').pool; // Get pool from server
  await pool.query(
    `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [logEntry.user_id, logEntry.action, logEntry.table_name, logEntry.record_id,
     logEntry.old_value, logEntry.new_value, logEntry.ip_address]
  );
}

async function insertDataAccessLog(accessLog) {
  const pool = require('../server').pool;
  await pool.query(
    `INSERT INTO data_access_log (user_id, patient_id, action, endpoint, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [accessLog.user_id, accessLog.patient_id, accessLog.action, accessLog.endpoint,
     accessLog.ip_address, accessLog.user_agent]
  );
}

function extractTableFromPath(path) {
  if (path.includes('appointment')) return 'appointment';
  if (path.includes('patient')) return 'patient';
  if (path.includes('treatment')) return 'appointment_treatment';
  return 'unknown';
}

module.exports = auditLogger;
```

**Integration in server.js:**
```javascript
const auditLogger = require('./middleware/auditLogger');

// Apply to all doctor routes
app.use('/api/doctor', auditLogger);
```

**Testing Criteria:**
- [ ] Update appointment status → Check audit_log table has entry
- [ ] View patient details → Check data_access_log table has entry
- [ ] Verify user_id, action, timestamp are recorded correctly
- [ ] Test with multiple concurrent requests (50+ users)

**Test Commands:**
```bash
# Test audit logging
curl -X PUT http://localhost:3000/api/doctor/appointments/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Completed"}'

# Verify in database
mysql -u root -p -e "USE HMS; SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 5;"
mysql -u root -p -e "USE HMS; SELECT * FROM data_access_log ORDER BY timestamp DESC LIMIT 5;"
```

#### 1.3 Session Management with Timeout
**File:** `backend/middleware/sessionManager.js`

```javascript
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

const sessionManager = async (req, res, next) => {
  if (!req.user || !req.headers.authorization) {
    return next();
  }

  const token = req.headers.authorization.split(' ')[1];
  const pool = require('../server').pool;

  try {
    // Check if session exists and is not expired
    const [sessions] = await pool.query(
      `SELECT * FROM user_sessions
       WHERE user_id = ? AND token = ? AND expires_at > NOW()
       ORDER BY last_activity DESC LIMIT 1`,
      [req.user.userId, token]
    );

    if (sessions.length === 0) {
      return res.status(401).json({ message: 'Session expired. Please login again.' });
    }

    const session = sessions[0];
    const timeSinceActivity = Date.now() - new Date(session.last_activity).getTime();

    // Check 30-minute inactivity timeout
    if (timeSinceActivity > SESSION_TIMEOUT) {
      await pool.query('DELETE FROM user_sessions WHERE session_id = ?', [session.session_id]);
      return res.status(401).json({ message: 'Session expired due to inactivity.' });
    }

    // Update last_activity timestamp
    await pool.query(
      'UPDATE user_sessions SET last_activity = NOW() WHERE session_id = ?',
      [session.session_id]
    );

    next();
  } catch (err) {
    console.error('Session management error:', err);
    next();
  }
};

// Function to create session on login
async function createSession(userId, token, ipAddress, userAgent) {
  const pool = require('../server').pool;
  const sessionId = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

  await pool.query(
    `INSERT INTO user_sessions (session_id, user_id, token, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, token, expiresAt, ipAddress, userAgent]
  );

  return sessionId;
}

// Function to destroy session on logout
async function destroySession(userId, token) {
  const pool = require('../server').pool;
  await pool.query(
    'DELETE FROM user_sessions WHERE user_id = ? AND token = ?',
    [userId, token]
  );
}

module.exports = { sessionManager, createSession, destroySession };
```

**Testing Criteria:**
- [ ] Login → Session created in user_sessions table
- [ ] Make API call → last_activity updates
- [ ] Wait 31 minutes → API call returns 401 "Session expired"
- [ ] Logout → Session deleted from table
- [ ] Multiple sessions per user supported

**Test Script:**
```javascript
// Test session timeout
async function testSessionTimeout() {
  const token = 'YOUR_TEST_TOKEN';

  // Make initial request
  const response1 = await fetch('http://localhost:3000/api/doctor/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Initial request:', response1.status); // Should be 200

  // Wait 31 minutes (or modify SESSION_TIMEOUT for testing)
  // setTimeout(async () => {
  //   const response2 = await fetch('http://localhost:3000/api/doctor/profile', {
  //     headers: { 'Authorization': `Bearer ${token}` }
  //   });
  //   console.log('After timeout:', response2.status); // Should be 401
  // }, 31 * 60 * 1000);
}
```

### Phase 1 Deliverables
- ✅ Database migration file executed
- ✅ Audit logging middleware integrated
- ✅ Session management with 30-minute timeout
- ✅ All audit logs writing to database
- ✅ Performance test: 50+ concurrent users

### Phase 1 Acceptance Criteria
1. All required database columns exist
2. Audit logs captured for all doctor actions (CREATE, UPDATE, DELETE)
3. Data access logs captured for patient data views
4. Sessions expire after 30 minutes of inactivity
5. No performance degradation with logging enabled

---

## PHASE 2: Clinical Documentation API (PRIMARY FEATURE)
**Duration:** 5-6 days
**Priority:** CRITICAL
**Dependencies:** Phase 1 complete

### Objectives
- Build API endpoints for treatment recording
- Implement consultation notes management with auto-save
- Enforce business rule: treatments only for completed appointments
- Create treatment catalogue management endpoints

### Tasks

#### 2.1 Treatment Catalogue API Endpoints
**File:** `backend/server.js` (add after doctor routes)

```javascript
// GET all active treatments from catalogue
app.get("/api/doctor/treatments/catalogue",
  authorize(['doctor']),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT service_code, name, description, price as base_price, category
        FROM treatment_catalogue
        WHERE is_active = TRUE
        ORDER BY category, name
      `);
      res.json(rows);
    } catch (err) {
      handleDatabaseError(res, err);
    }
});

// GET treatments by category
app.get("/api/doctor/treatments/catalogue/category/:category",
  authorize(['doctor']),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT service_code, name, description, price as base_price
        FROM treatment_catalogue
        WHERE category = ? AND is_active = TRUE
        ORDER BY name
      `, [req.params.category]);
      res.json(rows);
    } catch (err) {
      handleDatabaseError(res, err);
    }
});

// GET all treatment categories
app.get("/api/doctor/treatments/categories",
  authorize(['doctor']),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT DISTINCT category
        FROM treatment_catalogue
        WHERE is_active = TRUE AND category IS NOT NULL
        ORDER BY category
      `);
      res.json(rows.map(r => r.category));
    } catch (err) {
      handleDatabaseError(res, err);
    }
});
```

#### 2.2 Treatment Recording API (with Business Rule Enforcement)
**File:** `backend/server.js`

```javascript
// GET treatments for a specific appointment
app.get("/api/doctor/appointments/:appointmentId/treatments",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { appointmentId } = req.params;

      // Verify appointment belongs to this doctor
      const [[appointment]] = await pool.query(
        'SELECT status FROM appointment WHERE appointment_id = ? AND doctor_id = ?',
        [appointmentId, req.doctorId]
      );

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found or not assigned to you.' });
      }

      // Get treatments for this appointment
      const [treatments] = await pool.query(`
        SELECT at.service_code, tc.name, tc.description, at.actual_price, at.notes
        FROM appointment_treatment at
        JOIN treatment_catalogue tc ON at.service_code = tc.service_code
        WHERE at.appointment_id = ?
      `, [appointmentId]);

      res.json({ appointment_status: appointment.status, treatments });
    } catch (err) {
      handleDatabaseError(res, err);
    }
});

// POST - Add treatment to appointment (CRITICAL BUSINESS RULE: Only for completed appointments)
app.post("/api/doctor/appointments/:appointmentId/treatments",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { appointmentId } = req.params;
      const { service_code, actual_price, notes } = req.body;

      // CRITICAL CHECK: Verify appointment is completed
      const [[appointment]] = await connection.query(
        'SELECT status FROM appointment WHERE appointment_id = ? AND doctor_id = ?',
        [appointmentId, req.doctorId]
      );

      if (!appointment) {
        await connection.rollback();
        return res.status(404).json({ message: 'Appointment not found or not assigned to you.' });
      }

      // REQ-4.4.1: Can only add treatments to completed appointments
      if (appointment.status !== 'Completed') {
        await connection.rollback();
        return res.status(400).json({
          message: 'Treatments can only be added to completed appointments. Please mark the appointment as completed first.',
          requirement: 'REQ-4.4.1'
        });
      }

      // Verify service_code exists in catalogue
      const [[treatment]] = await connection.query(
        'SELECT price FROM treatment_catalogue WHERE service_code = ?',
        [service_code]
      );

      if (!treatment) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid service code.' });
      }

      // Use actual_price if provided, otherwise use catalogue price
      const finalPrice = actual_price || treatment.price;

      // Insert treatment
      await connection.query(
        `INSERT INTO appointment_treatment (appointment_id, service_code, notes, actual_price)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE notes = VALUES(notes), actual_price = VALUES(actual_price)`,
        [appointmentId, service_code, notes, finalPrice]
      );

      await connection.commit();
      res.status(201).json({ message: 'Treatment added successfully' });

    } catch (err) {
      await connection.rollback();
      handleDatabaseError(res, err);
    } finally {
      connection.release();
    }
});

// DELETE - Remove treatment from appointment
app.delete("/api/doctor/appointments/:appointmentId/treatments/:serviceCode",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { appointmentId, serviceCode } = req.params;

      // Verify appointment belongs to doctor
      const [[appointment]] = await pool.query(
        'SELECT appointment_id FROM appointment WHERE appointment_id = ? AND doctor_id = ?',
        [appointmentId, req.doctorId]
      );

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      await pool.query(
        'DELETE FROM appointment_treatment WHERE appointment_id = ? AND service_code = ?',
        [appointmentId, serviceCode]
      );

      res.status(204).send();
    } catch (err) {
      handleDatabaseError(res, err);
    }
});
```

#### 2.3 Consultation Notes API with Auto-Save Support
**File:** `backend/server.js`

```javascript
// GET consultation notes for appointment
app.get("/api/doctor/appointments/:appointmentId/notes",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { appointmentId } = req.params;

      const [[appointment]] = await pool.query(
        'SELECT consultation_notes, status FROM appointment WHERE appointment_id = ? AND doctor_id = ?',
        [appointmentId, req.doctorId]
      );

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      res.json({
        consultation_notes: appointment.consultation_notes,
        status: appointment.status,
        can_edit: appointment.status === 'Completed'
      });
    } catch (err) {
      handleDatabaseError(res, err);
    }
});

// PUT - Update consultation notes (supports auto-save)
app.put("/api/doctor/appointments/:appointmentId/notes",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { consultation_notes } = req.body;

      // Verify appointment belongs to doctor
      const [[appointment]] = await pool.query(
        'SELECT status FROM appointment WHERE appointment_id = ? AND doctor_id = ?',
        [appointmentId, req.doctorId]
      );

      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      // Update notes
      await pool.query(
        'UPDATE appointment SET consultation_notes = ? WHERE appointment_id = ?',
        [consultation_notes, appointmentId]
      );

      res.json({
        message: 'Notes saved successfully',
        saved_at: new Date().toISOString()
      });

    } catch (err) {
      handleDatabaseError(res, err);
    }
});
```

#### 2.4 Medical History API Endpoints
**File:** `backend/server.js`

```javascript
// GET patient medical history (allergies, medications, history)
app.get("/api/doctor/patients/:patientId/medical-history",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { patientId } = req.params;

      const [[patient]] = await pool.query(`
        SELECT medical_history, allergies, current_medications
        FROM patient WHERE patient_id = ?
      `, [patientId]);

      if (!patient) {
        return res.status(404).json({ message: 'Patient not found.' });
      }

      res.json(patient);
    } catch (err) {
      handleDatabaseError(res, err);
    }
});

// UPDATE patient medical history (doctors can update)
app.put("/api/doctor/patients/:patientId/medical-history",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { medical_history, allergies, current_medications } = req.body;

      await pool.query(`
        UPDATE patient
        SET medical_history = ?, allergies = ?, current_medications = ?
        WHERE patient_id = ?
      `, [medical_history, allergies, current_medications, patientId]);

      res.json({ message: 'Medical history updated successfully' });
    } catch (err) {
      handleDatabaseError(res, err);
    }
});
```

### Phase 2 Testing Criteria

**API Endpoint Tests:**
```bash
# Test 1: Get treatment catalogue
curl -X GET http://localhost:3000/api/doctor/treatments/catalogue \
  -H "Authorization: Bearer DOCTOR_TOKEN"
# Expected: List of all active treatments

# Test 2: Try adding treatment to scheduled appointment (should fail)
curl -X POST http://localhost:3000/api/doctor/appointments/1/treatments \
  -H "Authorization: Bearer DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service_code":"CONS-GEN","actual_price":50.00}'
# Expected: 400 error "Treatments can only be added to completed appointments"

# Test 3: Mark appointment as completed, then add treatment
curl -X PUT http://localhost:3000/api/doctor/appointments/1/status \
  -H "Authorization: Bearer DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Completed"}'

curl -X POST http://localhost:3000/api/doctor/appointments/1/treatments \
  -H "Authorization: Bearer DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service_code":"CONS-GEN","actual_price":50.00,"notes":"Standard consultation"}'
# Expected: 201 "Treatment added successfully"

# Test 4: Auto-save notes
curl -X PUT http://localhost:3000/api/doctor/appointments/1/notes \
  -H "Authorization: Bearer DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"consultation_notes":"Patient presents with fever and cough..."}'
# Expected: 200 with saved_at timestamp

# Test 5: Get treatments for appointment
curl -X GET http://localhost:3000/api/doctor/appointments/1/treatments \
  -H "Authorization: Bearer DOCTOR_TOKEN"
# Expected: List of treatments with details
```

**Database Verification:**
```sql
-- Verify treatments are only linked to completed appointments
SELECT a.appointment_id, a.status, COUNT(at.service_code) as treatment_count
FROM appointment a
LEFT JOIN appointment_treatment at ON a.appointment_id = at.appointment_id
GROUP BY a.appointment_id, a.status
HAVING treatment_count > 0 AND a.status != 'Completed';
-- Should return 0 rows

-- Check consultation notes
SELECT appointment_id, consultation_notes, status
FROM appointment
WHERE consultation_notes IS NOT NULL;
```

### Phase 2 Deliverables
- ✅ Treatment catalogue API endpoints (3 endpoints)
- ✅ Treatment recording API with business rule enforcement (3 endpoints)
- ✅ Consultation notes API with auto-save (2 endpoints)
- ✅ Medical history API (2 endpoints)
- ✅ API documentation with curl examples
- ✅ Unit tests for business rules

### Phase 2 Acceptance Criteria
1. ✅ REQ-4.4.1: Cannot add treatments to non-completed appointments (enforced with 400 error)
2. ✅ REQ-4.4.2: Treatments selected from pre-defined catalogue
3. ✅ REQ-4.4.3: Each treatment has service code and price
4. ✅ REQ-4.4.4: Multiple treatments per appointment supported
5. ✅ REQ-4.4.5: Consultation notes saved with timestamp
6. ✅ Auto-save functionality supported (every 30 seconds from frontend)
7. ✅ All actions audited in audit_log table

---

## PHASE 3: Doctor Portal Frontend - Clinical Documentation UI
**Duration:** 6-7 days
**Priority:** HIGH
**Dependencies:** Phase 2 complete

### Objectives
- Build treatment recording interface
- Implement consultation notes editor with auto-save
- Create appointment detail view with treatment management
- Add medical history display/editing

### Tasks

#### 3.1 Treatment Recording Interface
**File:** `frontend/components/TreatmentRecorder.js`

```javascript
class TreatmentRecorder {
  constructor(appointmentId, appointmentStatus) {
    this.appointmentId = appointmentId;
    this.appointmentStatus = appointmentStatus;
    this.selectedTreatments = [];
    this.catalogueCache = null;
  }

  async loadTreatmentCatalogue() {
    if (this.catalogueCache) return this.catalogueCache;

    const response = await fetch('/api/doctor/treatments/catalogue', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    this.catalogueCache = await response.json();
    return this.catalogueCache;
  }

  async loadExistingTreatments() {
    const response = await fetch(`/api/doctor/appointments/${this.appointmentId}/treatments`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();
    this.selectedTreatments = data.treatments || [];
    return this.selectedTreatments;
  }

  async addTreatment(serviceCode, actualPrice, notes) {
    const response = await fetch(`/api/doctor/appointments/${this.appointmentId}/treatments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ service_code: serviceCode, actual_price: actualPrice, notes })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  }

  async removeTreatment(serviceCode) {
    const response = await fetch(
      `/api/doctor/appointments/${this.appointmentId}/treatments/${serviceCode}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to remove treatment');
    }
  }

  renderTreatmentSelector(containerId) {
    const container = document.getElementById(containerId);

    // Show warning if appointment not completed
    if (this.appointmentStatus !== 'Completed') {
      container.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          <strong>Appointment must be marked as Completed before adding treatments.</strong>
          <br>Please complete the appointment first using the status dropdown above.
        </div>
      `;
      return;
    }

    // Render treatment selection interface
    this.loadTreatmentCatalogue().then(catalogue => {
      // Group by category
      const categories = {};
      catalogue.forEach(treatment => {
        const cat = treatment.category || 'Other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(treatment);
      });

      let html = `
        <div class="treatment-selector">
          <h6><i class="bi bi-clipboard2-pulse me-2"></i>Add Treatments</h6>
          <div class="mb-3">
            <select id="treatment-select" class="form-select">
              <option value="">Select a treatment...</option>
      `;

      Object.keys(categories).sort().forEach(category => {
        html += `<optgroup label="${category}">`;
        categories[category].forEach(t => {
          html += `<option value="${t.service_code}" data-price="${t.base_price}">
            ${t.name} - $${t.base_price}
          </option>`;
        });
        html += `</optgroup>`;
      });

      html += `
            </select>
          </div>
          <div class="mb-3">
            <label>Price Override (optional)</label>
            <input type="number" id="treatment-price" class="form-control" step="0.01" placeholder="Leave blank to use standard price">
          </div>
          <div class="mb-3">
            <label>Notes</label>
            <textarea id="treatment-notes" class="form-control" rows="2" placeholder="Additional notes for this treatment..."></textarea>
          </div>
          <button id="add-treatment-btn" class="btn btn-primary">
            <i class="bi bi-plus-circle me-2"></i>Add Treatment
          </button>
        </div>
        <hr>
        <h6><i class="bi bi-list-check me-2"></i>Selected Treatments</h6>
        <div id="selected-treatments-list"></div>
      `;

      container.innerHTML = html;

      // Event listeners
      document.getElementById('add-treatment-btn').addEventListener('click', () => {
        this.handleAddTreatment();
      });

      // Load existing treatments
      this.loadExistingTreatments().then(() => {
        this.renderSelectedTreatments();
      });
    });
  }

  async handleAddTreatment() {
    const select = document.getElementById('treatment-select');
    const serviceCode = select.value;
    const price = document.getElementById('treatment-price').value;
    const notes = document.getElementById('treatment-notes').value;

    if (!serviceCode) {
      showToast('Please select a treatment', 'warning');
      return;
    }

    try {
      await this.addTreatment(serviceCode, price || null, notes);
      showToast('Treatment added successfully', 'success');

      // Reset form
      select.value = '';
      document.getElementById('treatment-price').value = '';
      document.getElementById('treatment-notes').value = '';

      // Reload list
      await this.loadExistingTreatments();
      this.renderSelectedTreatments();

    } catch (error) {
      showToast(error.message, 'danger');
    }
  }

  renderSelectedTreatments() {
    const container = document.getElementById('selected-treatments-list');

    if (this.selectedTreatments.length === 0) {
      container.innerHTML = '<p class="text-muted">No treatments added yet.</p>';
      return;
    }

    let html = '<div class="list-group">';
    this.selectedTreatments.forEach(treatment => {
      html += `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <strong>${treatment.name}</strong><br>
            <small class="text-muted">Code: ${treatment.service_code}</small><br>
            <small>Price: $${treatment.actual_price}</small>
            ${treatment.notes ? `<br><small class="text-info">${treatment.notes}</small>` : ''}
          </div>
          <button class="btn btn-sm btn-outline-danger" onclick="removeTreatmentHandler('${treatment.service_code}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
  }
}

// Global function for remove button
async function removeTreatmentHandler(serviceCode) {
  if (!confirm('Remove this treatment?')) return;

  try {
    const recorder = window.currentTreatmentRecorder;
    await recorder.removeTreatment(serviceCode);
    showToast('Treatment removed', 'success');
    await recorder.loadExistingTreatments();
    recorder.renderSelectedTreatments();
  } catch (error) {
    showToast('Failed to remove treatment', 'danger');
  }
}
```

#### 3.2 Consultation Notes Editor with Auto-Save
**File:** `frontend/components/ConsultationNotesEditor.js`

```javascript
class ConsultationNotesEditor {
  constructor(appointmentId) {
    this.appointmentId = appointmentId;
    this.autoSaveInterval = null;
    this.lastSavedContent = '';
    this.isDirty = false;
  }

  async load() {
    const response = await fetch(`/api/doctor/appointments/${this.appointmentId}/notes`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();
    return data;
  }

  async save(notes) {
    const response = await fetch(`/api/doctor/appointments/${this.appointmentId}/notes`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ consultation_notes: notes })
    });

    if (!response.ok) {
      throw new Error('Failed to save notes');
    }

    return await response.json();
  }

  render(containerId) {
    this.load().then(data => {
      const container = document.getElementById(containerId);

      container.innerHTML = `
        <div class="consultation-notes-editor">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6><i class="bi bi-journal-medical me-2"></i>Consultation Notes</h6>
            <span id="save-status" class="text-muted small">
              <i class="bi bi-check-circle text-success"></i> All changes saved
            </span>
          </div>
          <textarea
            id="consultation-notes-textarea"
            class="form-control"
            rows="8"
            placeholder="Enter detailed diagnosis, observations, and treatment plan..."
            ${data.can_edit ? '' : 'readonly'}
          >${data.consultation_notes || ''}</textarea>
          <div class="text-muted small mt-2">
            <i class="bi bi-info-circle me-1"></i>
            ${data.can_edit ? 'Auto-saves every 30 seconds' : 'Notes are read-only for non-completed appointments'}
          </div>
        </div>
      `;

      this.lastSavedContent = data.consultation_notes || '';

      if (data.can_edit) {
        this.startAutoSave();
      }
    });
  }

  startAutoSave() {
    const textarea = document.getElementById('consultation-notes-textarea');

    // Track changes
    textarea.addEventListener('input', () => {
      this.isDirty = textarea.value !== this.lastSavedContent;
      if (this.isDirty) {
        this.updateSaveStatus('Unsaved changes...', 'warning');
      }
    });

    // Auto-save every 30 seconds (REQ: Section 5.1)
    this.autoSaveInterval = setInterval(() => {
      if (this.isDirty) {
        this.performAutoSave();
      }
    }, 30000); // 30 seconds
  }

  async performAutoSave() {
    const textarea = document.getElementById('consultation-notes-textarea');
    const content = textarea.value;

    try {
      this.updateSaveStatus('Saving...', 'info');
      const result = await this.save(content);
      this.lastSavedContent = content;
      this.isDirty = false;
      this.updateSaveStatus(`Saved at ${new Date(result.saved_at).toLocaleTimeString()}`, 'success');
    } catch (error) {
      this.updateSaveStatus('Save failed', 'danger');
      console.error('Auto-save error:', error);
    }
  }

  updateSaveStatus(message, type) {
    const statusEl = document.getElementById('save-status');
    if (!statusEl) return;

    const icons = {
      'success': 'check-circle',
      'warning': 'exclamation-triangle',
      'info': 'arrow-clockwise',
      'danger': 'x-circle'
    };

    const colors = {
      'success': 'text-success',
      'warning': 'text-warning',
      'info': 'text-info',
      'danger': 'text-danger'
    };

    statusEl.innerHTML = `<i class="bi bi-${icons[type]} ${colors[type]}"></i> ${message}`;
  }

  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}
```

#### 3.3 Enhanced Appointment Detail Modal
**File:** `frontend/doctor-appointments.js` (update existing code)

```javascript
async function showAppointmentDetails(appointmentId) {
  try {
    // Fetch appointment details
    const response = await fetch(`/api/doctor/appointments/${appointmentId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const appointment = await response.json();

    // Create modal
    const modal = new bootstrap.Modal(document.getElementById('appointmentDetailsModal'));
    const modalBody = document.getElementById('appointmentDetailsModalBody');

    modalBody.innerHTML = `
      <div class="row">
        <div class="col-md-4">
          <h6>Patient Information</h6>
          <p><strong>Name:</strong> ${appointment.patient_name}</p>
          <p><strong>Age:</strong> ${appointment.patient_age} years</p>
          <p><strong>Contact:</strong> ${appointment.patient_contact}</p>
          <p><strong>Insurance:</strong> ${appointment.insurance_provider || 'None'}</p>
          <button class="btn btn-sm btn-outline-primary" onclick="viewMedicalHistory(${appointment.patient_id})">
            <i class="bi bi-file-medical"></i> View Medical History
          </button>
        </div>
        <div class="col-md-8">
          <h6>Appointment Details</h6>
          <p><strong>Date:</strong> ${new Date(appointment.schedule_date).toLocaleString()}</p>
          <p><strong>Status:</strong> <span class="badge status-${appointment.status}">${appointment.status}</span></p>

          <div class="mb-3">
            <label>Change Status:</label>
            <select id="status-select" class="form-select">
              <option value="Scheduled" ${appointment.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="Completed" ${appointment.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Cancelled" ${appointment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
            <button class="btn btn-primary btn-sm mt-2" onclick="updateAppointmentStatus(${appointmentId})">
              Update Status
            </button>
          </div>

          <hr>

          <!-- Consultation Notes -->
          <div id="notes-container-${appointmentId}"></div>

          <hr>

          <!-- Treatment Recorder -->
          <div id="treatment-container-${appointmentId}"></div>
        </div>
      </div>
    `;

    modal.show();

    // Initialize components
    const notesEditor = new ConsultationNotesEditor(appointmentId);
    notesEditor.render(`notes-container-${appointmentId}`);

    const treatmentRecorder = new TreatmentRecorder(appointmentId, appointment.status);
    treatmentRecorder.renderTreatmentSelector(`treatment-container-${appointmentId}`);
    window.currentTreatmentRecorder = treatmentRecorder; // Store globally for remove handler

  } catch (error) {
    showToast('Failed to load appointment details', 'danger');
    console.error(error);
  }
}

async function updateAppointmentStatus(appointmentId) {
  const status = document.getElementById('status-select').value;

  try {
    const response = await fetch(`/api/doctor/appointments/${appointmentId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type: application/json'
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) throw new Error('Failed to update status');

    showToast('Status updated successfully', 'success');

    // Reload appointment details to refresh treatment section
    showAppointmentDetails(appointmentId);

  } catch (error) {
    showToast(error.message, 'danger');
  }
}
```

### Phase 3 Testing Criteria

**Manual UI Tests:**
1. ✅ Open appointment → Status is "Scheduled" → Treatment section shows warning
2. ✅ Change status to "Completed" → Treatment selector appears
3. ✅ Select treatment from dropdown → Add → Appears in selected treatments list
4. ✅ Type in consultation notes → Wait 30 seconds → "Saved at..." message appears
5. ✅ Add multiple treatments → Verify all saved
6. ✅ Remove treatment → Confirm removal works
7. ✅ Close modal and reopen → All data persists
8. ✅ Try adding treatment to scheduled appointment → See error message

**Browser Console Tests:**
```javascript
// Test auto-save
const editor = new ConsultationNotesEditor(1);
editor.render('test-container');
// Type in textarea, wait 30 seconds, check network tab for PUT request

// Test treatment recorder
const recorder = new TreatmentRecorder(1, 'Completed');
recorder.renderTreatmentSelector('test-container');
// Try adding treatments and verify POST requests
```

### Phase 3 Deliverables
- ✅ TreatmentRecorder component with catalogue selection
- ✅ ConsultationNotesEditor with 30-second auto-save
- ✅ Enhanced appointment detail modal
- ✅ Medical history viewer
- ✅ Status change interface with treatment section refresh
- ✅ Error handling and user feedback (toasts)

### Phase 3 Acceptance Criteria
1. ✅ REQ-UI-01: Color-coded status indicators visible
2. ✅ REQ-UI-05: Field-level access control (treatment section locked until completed)
3. ✅ REQ-UI-06: Input validation with contextual help messages
4. ✅ Section 5.1: Auto-save every 30 seconds implemented
5. ✅ Treatment can only be added to completed appointments (UI enforces)
6. ✅ Multiple treatments per appointment supported in UI
7. ✅ Consultation notes save with visual feedback

---

## PHASE 4: Reports & Analytics
**Duration:** 4-5 days
**Priority:** MEDIUM
**Dependencies:** Phase 2 complete

### Objectives
- Build doctor-wise revenue report
- Create treatments per category report
- Implement appointment summary dashboard
- Add date range filters

### Tasks

#### 4.1 Doctor-Wise Revenue Report API
**File:** `backend/server.js`

```javascript
// GET doctor revenue report (REQ-4.7.2)
app.get("/api/doctor/reports/revenue",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Start date and end date are required' });
      }

      // Get revenue from treatments administered by this doctor
      const [treatments] = await pool.query(`
        SELECT
          tc.category,
          tc.name as treatment_name,
          COUNT(at.service_code) as count,
          SUM(at.actual_price) as total_revenue,
          AVG(at.actual_price) as avg_price
        FROM appointment a
        JOIN appointment_treatment at ON a.appointment_id = at.appointment_id
        JOIN treatment_catalogue tc ON at.service_code = tc.service_code
        WHERE a.doctor_id = ?
          AND a.status = 'Completed'
          AND DATE(a.schedule_date) BETWEEN ? AND ?
        GROUP BY tc.category, tc.name
        ORDER BY total_revenue DESC
      `, [req.doctorId, startDate, endDate]);

      // Get total summary
      const [[summary]] = await pool.query(`
        SELECT
          COUNT(DISTINCT a.appointment_id) as total_appointments,
          COUNT(at.service_code) as total_treatments,
          COALESCE(SUM(at.actual_price), 0) as total_revenue
        FROM appointment a
        LEFT JOIN appointment_treatment at ON a.appointment_id = at.appointment_id
        WHERE a.doctor_id = ?
          AND a.status = 'Completed'
          AND DATE(a.schedule_date) BETWEEN ? AND ?
      `, [req.doctorId, startDate, endDate]);

      res.json({ treatments, summary });

    } catch (err) {
      handleDatabaseError(res, err);
    }
});
```

#### 4.2 Treatments Per Category Report API
**File:** `backend/server.js`

```javascript
// GET treatments per category report (REQ-4.7.4)
app.get("/api/doctor/reports/treatments-by-category",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const [categories] = await pool.query(`
        SELECT
          tc.category,
          COUNT(at.service_code) as treatment_count,
          SUM(at.actual_price) as category_revenue
        FROM appointment a
        JOIN appointment_treatment at ON a.appointment_id = at.appointment_id
        JOIN treatment_catalogue tc ON at.service_code = tc.service_code
        WHERE a.doctor_id = ?
          AND DATE(a.schedule_date) BETWEEN ? AND ?
        GROUP BY tc.category
        ORDER BY treatment_count DESC
      `, [req.doctorId, startDate || '1900-01-01', endDate || '2099-12-31']);

      res.json(categories);

    } catch (err) {
      handleDatabaseError(res, err);
    }
});
```

#### 4.3 Appointment Summary Report API
**File:** `backend/server.js`

```javascript
// GET appointment summary report
app.get("/api/doctor/reports/appointment-summary",
  authorize(['doctor']),
  getDoctorInfoFromToken,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const [summary] = await pool.query(`
        SELECT
          status,
          COUNT(*) as count
        FROM appointment
        WHERE doctor_id = ?
          AND DATE(schedule_date) BETWEEN ? AND ?
        GROUP BY status
      `, [req.doctorId, startDate || '1900-01-01', endDate || '2099-12-31']);

      // Get daily breakdown
      const [daily] = await pool.query(`
        SELECT
          DATE(schedule_date) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM appointment
        WHERE doctor_id = ?
          AND DATE(schedule_date) BETWEEN ? AND ?
        GROUP BY DATE(schedule_date)
        ORDER BY date DESC
      `, [req.doctorId, startDate || '1900-01-01', endDate || '2099-12-31']);

      res.json({ summary, daily });

    } catch (err) {
      handleDatabaseError(res, err);
    }
});
```

#### 4.4 Reports Dashboard UI
**File:** `frontend/doctor-reports.html` (new file)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Doctor Reports | ClinicPro</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container-fluid mt-4">
        <h2><i class="bi bi-graph-up me-2"></i>Reports & Analytics</h2>

        <!-- Date Range Filter -->
        <div class="card mb-4">
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-3">
                        <label>Start Date</label>
                        <input type="date" id="report-start-date" class="form-control">
                    </div>
                    <div class="col-md-3">
                        <label>End Date</label>
                        <input type="date" id="report-end-date" class="form-control">
                    </div>
                    <div class="col-md-3 d-flex align-items-end">
                        <button id="generate-reports-btn" class="btn btn-primary">
                            <i class="bi bi-arrow-clockwise me-2"></i>Generate Reports
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Revenue Report -->
        <div class="card mb-4">
            <div class="card-header">
                <h5><i class="bi bi-currency-dollar me-2"></i>Revenue Report</h5>
            </div>
            <div class="card-body">
                <div id="revenue-summary" class="row mb-4"></div>
                <div id="revenue-details"></div>
            </div>
        </div>

        <!-- Treatments by Category -->
        <div class="card mb-4">
            <div class="card-header">
                <h5><i class="bi bi-pie-chart me-2"></i>Treatments by Category</h5>
            </div>
            <div class="card-body">
                <canvas id="category-chart" height="100"></canvas>
            </div>
        </div>

        <!-- Appointment Summary -->
        <div class="card">
            <div class="card-header">
                <h5><i class="bi bi-calendar-check me-2"></i>Appointment Summary</h5>
            </div>
            <div class="card-body">
                <canvas id="appointment-chart" height="100"></canvas>
            </div>
        </div>
    </div>

    <script src="doctor-reports.js"></script>
</body>
</html>
```

**File:** `frontend/doctor-reports.js`

```javascript
let revenueChart, categoryChart, appointmentChart;

async function generateReports() {
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;

  if (!startDate || !endDate) {
    alert('Please select both start and end dates');
    return;
  }

  try {
    // Fetch all reports in parallel
    const [revenueData, categoryData, appointmentData] = await Promise.all([
      fetch(`/api/doctor/reports/revenue?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      }).then(r => r.json()),

      fetch(`/api/doctor/reports/treatments-by-category?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      }).then(r => r.json()),

      fetch(`/api/doctor/reports/appointment-summary?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      }).then(r => r.json())
    ]);

    renderRevenueSummary(revenueData.summary);
    renderRevenueDetails(revenueData.treatments);
    renderCategoryChart(categoryData);
    renderAppointmentChart(appointmentData.daily);

  } catch (error) {
    console.error('Report generation error:', error);
    alert('Failed to generate reports');
  }
}

function renderRevenueSummary(summary) {
  const container = document.getElementById('revenue-summary');
  container.innerHTML = `
    <div class="col-md-4">
      <div class="card bg-primary text-white">
        <div class="card-body">
          <h3>$${summary.total_revenue.toFixed(2)}</h3>
          <p>Total Revenue</p>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card bg-success text-white">
        <div class="card-body">
          <h3>${summary.total_appointments}</h3>
          <p>Completed Appointments</p>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card bg-info text-white">
        <div class="card-body">
          <h3>${summary.total_treatments}</h3>
          <p>Total Treatments</p>
        </div>
      </div>
    </div>
  `;
}

function renderRevenueDetails(treatments) {
  const container = document.getElementById('revenue-details');

  let html = `
    <table class="table table-hover">
      <thead>
        <tr>
          <th>Category</th>
          <th>Treatment</th>
          <th>Count</th>
          <th>Avg Price</th>
          <th>Total Revenue</th>
        </tr>
      </thead>
      <tbody>
  `;

  treatments.forEach(t => {
    html += `
      <tr>
        <td><span class="badge bg-secondary">${t.category}</span></td>
        <td>${t.treatment_name}</td>
        <td>${t.count}</td>
        <td>$${t.avg_price.toFixed(2)}</td>
        <td><strong>$${t.total_revenue.toFixed(2)}</strong></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderCategoryChart(categories) {
  const ctx = document.getElementById('category-chart').getContext('2d');

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map(c => c.category),
      datasets: [{
        data: categories.map(c => c.treatment_count),
        backgroundColor: [
          '#6a5af9', '#28a745', '#ffc107', '#17a2b8', '#dc3545', '#6c757d'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' },
        title: { display: true, text: 'Treatment Distribution by Category' }
      }
    }
  });
}

function renderAppointmentChart(daily) {
  const ctx = document.getElementById('appointment-chart').getContext('2d');

  if (appointmentChart) appointmentChart.destroy();

  appointmentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: daily.map(d => new Date(d.date).toLocaleDateString()),
      datasets: [
        {
          label: 'Completed',
          data: daily.map(d => d.completed),
          backgroundColor: '#28a745'
        },
        {
          label: 'Scheduled',
          data: daily.map(d => d.scheduled),
          backgroundColor: '#6a5af9'
        },
        {
          label: 'Cancelled',
          data: daily.map(d => d.cancelled),
          backgroundColor: '#dc3545'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      },
      plugins: {
        title: { display: true, text: 'Daily Appointment Status' }
      }
    }
  });
}

// Initialize with last 30 days
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  document.getElementById('report-start-date').value = thirtyDaysAgo.toISOString().split('T')[0];
  document.getElementById('report-end-date').value = today.toISOString().split('T')[0];

  document.getElementById('generate-reports-btn').addEventListener('click', generateReports);

  generateReports();
});
```

### Phase 4 Testing Criteria

**API Tests:**
```bash
# Test revenue report
curl -X GET "http://localhost:3000/api/doctor/reports/revenue?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer DOCTOR_TOKEN"
# Expected: JSON with treatments array and summary

# Test category report
curl -X GET "http://localhost:3000/api/doctor/reports/treatments-by-category?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer DOCTOR_TOKEN"
# Expected: Array of categories with counts

# Test appointment summary
curl -X GET "http://localhost:3000/api/doctor/reports/appointment-summary?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer DOCTOR_TOKEN"
# Expected: Summary by status and daily breakdown
```

**UI Tests:**
1. ✅ Open reports page → Default shows last 30 days
2. ✅ Select date range → Click generate → Charts update
3. ✅ Revenue summary cards show correct totals
4. ✅ Revenue details table shows all treatments
5. ✅ Category pie chart renders correctly
6. ✅ Daily appointment bar chart shows stacked data
7. ✅ Test with different date ranges (1 day, 1 week, 1 year)

### Phase 4 Deliverables
- ✅ Doctor revenue report API (REQ-4.7.2)
- ✅ Treatments per category report API (REQ-4.7.4)
- ✅ Appointment summary report API
- ✅ Reports dashboard with Chart.js visualizations
- ✅ Date range filtering
- ✅ Export functionality (optional)

### Phase 4 Acceptance Criteria
1. ✅ REQ-4.7.2: Doctor-wise revenue report shows total revenue from treatments
2. ✅ REQ-4.7.4: Treatments per category counted correctly
3. ✅ Reports generated within 10 seconds for up to 10,000 records (Section 5.1)
4. ✅ Charts render correctly on desktop and mobile
5. ✅ Date filtering works accurately
6. ✅ Revenue calculations match invoice totals

---

## PHASE 5: Security Enhancements & Compliance
**Duration:** 4-5 days
**Priority:** HIGH
**Dependencies:** Phase 1-3 complete

### Objectives
- Implement comprehensive audit logging for all doctor actions
- Add PDPA compliance features
- Implement password policy enforcement
- Add activity monitoring dashboard (admin view)

### Tasks

#### 5.1 Enhanced Audit Logging with Retention Policy
**File:** `backend/jobs/auditCleanup.js`

```javascript
// Audit log cleanup job (15-year retention per Section 5.7)
const cron = require('node-cron');
const mysql = require('mysql2/promise');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running audit log cleanup...');

  const pool = require('../server').pool;

  try {
    // Delete audit logs older than 15 years
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() - 15);

    const [result] = await pool.query(
      'DELETE FROM audit_log WHERE timestamp < ?',
      [retentionDate]
    );

    console.log(`Cleaned up ${result.affectedRows} audit log entries`);

    // Archive old logs to separate table (optional)
    // await pool.query('INSERT INTO audit_log_archive SELECT * FROM audit_log WHERE timestamp < ?', [archiveDate]);

  } catch (err) {
    console.error('Audit cleanup error:', err);
  }
});
```

#### 5.2 Password Policy Enforcement
**File:** `backend/middleware/passwordPolicy.js`

```javascript
function validatePassword(password) {
  const errors = [];

  // Section 5.3: Strong password policy
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check against common passwords
  const commonPasswords = ['password123', 'admin123', 'doctor123', 'clinic123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validatePassword };
```

#### 5.3 Data Access Logging for PDPA Compliance
**File:** `backend/middleware/pdpaLogger.js`

```javascript
// Enhanced data access logging for PDPA compliance (Sri Lanka PDPA No. 9 of 2022)
const pdpaLogger = async (req, res, next) => {
  if (!req.user) return next();

  const sensitiveEndpoints = [
    '/api/doctor/patients/',
    '/api/doctor/patients/:id/history',
    '/api/doctor/patients/:id/medical-history'
  ];

  const isSensitiveData = sensitiveEndpoints.some(pattern => req.path.includes(pattern));

  if (isSensitiveData && req.method === 'GET') {
    const pool = require('../server').pool;
    const patientId = req.params.patientId;

    // Log data access with detailed information
    await pool.query(
      `INSERT INTO data_access_log
       (user_id, patient_id, action, endpoint, ip_address, user_agent, timestamp)
       VALUES (?, ?, 'VIEW', ?, ?, ?, NOW())`,
      [req.user.userId, patientId, req.path, req.ip, req.headers['user-agent']]
    );

    // Check for suspicious access patterns
    const [recentAccess] = await pool.query(
      `SELECT COUNT(*) as access_count
       FROM data_access_log
       WHERE user_id = ? AND timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
      [req.user.userId]
    );

    // Alert if excessive access (potential data breach attempt)
    if (recentAccess[0].access_count > 50) {
      console.warn(`SECURITY ALERT: User ${req.user.userId} accessed ${recentAccess[0].access_count} patient records in 5 minutes`);
      // TODO: Send alert to admin, possibly lock account
    }
  }

  next();
};

module.exports = pdpaLogger;
```

#### 5.4 Audit Trail Viewer (Admin/Compliance)
**File:** `backend/server.js`

```javascript
// Admin endpoint to view audit logs (for compliance audits)
app.get("/api/admin/audit-logs",
  authorize(['admin']),
  async (req, res) => {
    try {
      const { userId, startDate, endDate, action, tableName, limit = 100 } = req.query;

      let query = `
        SELECT al.*, ai.username, r.name as role
        FROM audit_log al
        JOIN account_info ai ON al.user_id = ai.user_id
        JOIN role r ON ai.role_id = r.role_id
        WHERE 1=1
      `;
      const params = [];

      if (userId) {
        query += ' AND al.user_id = ?';
        params.push(userId);
      }

      if (startDate && endDate) {
        query += ' AND DATE(al.timestamp) BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }

      if (action) {
        query += ' AND al.action LIKE ?';
        params.push(`%${action}%`);
      }

      if (tableName) {
        query += ' AND al.table_name = ?';
        params.push(tableName);
      }

      query += ' ORDER BY al.timestamp DESC LIMIT ?';
      params.push(parseInt(limit));

      const [logs] = await pool.query(query, params);
      res.json(logs);

    } catch (err) {
      handleDatabaseError(res, err);
    }
});

// Admin endpoint to view data access logs (PDPA compliance)
app.get("/api/admin/data-access-logs",
  authorize(['admin']),
  async (req, res) => {
    try {
      const { userId, patientId, startDate, endDate, limit = 100 } = req.query;

      let query = `
        SELECT dal.*, ai.username, p.name as patient_name
        FROM data_access_log dal
        JOIN account_info ai ON dal.user_id = ai.user_id
        LEFT JOIN patient p ON dal.patient_id = p.patient_id
        WHERE 1=1
      `;
      const params = [];

      if (userId) {
        query += ' AND dal.user_id = ?';
        params.push(userId);
      }

      if (patientId) {
        query += ' AND dal.patient_id = ?';
        params.push(patientId);
      }

      if (startDate && endDate) {
        query += ' AND DATE(dal.timestamp) BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }

      query += ' ORDER BY dal.timestamp DESC LIMIT ?';
      params.push(parseInt(limit));

      const [logs] = await pool.query(query, params);
      res.json(logs);

    } catch (err) {
      handleDatabaseError(res, err);
    }
});
```

### Phase 5 Testing Criteria

**Security Tests:**
```bash
# Test 1: Verify audit logging
# Make several doctor actions, then check audit_log table
mysql -u root -p -e "USE HMS; SELECT * FROM audit_log WHERE user_id = 2 ORDER BY timestamp DESC LIMIT 10;"

# Test 2: Verify data access logging
# View patient records, then check data_access_log
mysql -u root -p -e "USE HMS; SELECT * FROM data_access_log WHERE user_id = 2 ORDER BY timestamp DESC LIMIT 10;"

# Test 3: Test password policy
curl -X POST http://localhost:3000/api/staff \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"testdoc","password":"weak","email":"test@test.com"}'
# Expected: 400 error with password policy requirements

# Test 4: Session timeout
# Login, wait 31 minutes, try API call
# Expected: 401 "Session expired due to inactivity"

# Test 5: Excessive access detection
# Write script to access 60 patient records in 5 minutes
# Expected: Console warning "SECURITY ALERT"
```

**Compliance Checklist:**
- [ ] All doctor actions logged to audit_log
- [ ] All patient data access logged to data_access_log
- [ ] Logs include: user_id, timestamp, action, IP address
- [ ] Logs are immutable (no UPDATE or DELETE permissions for doctors)
- [ ] 15-year retention policy implemented
- [ ] Password policy enforced (12+ chars, upper, lower, number, special)
- [ ] Session timeout after 30 minutes inactivity
- [ ] Excessive access alerts generated

### Phase 5 Deliverables
- ✅ Enhanced audit logging with retention policy
- ✅ PDPA-compliant data access logging
- ✅ Password policy enforcement
- ✅ Excessive access detection
- ✅ Admin audit viewer endpoints
- ✅ Security monitoring dashboard

### Phase 5 Acceptance Criteria
1. ✅ Section 2.2: Audit logs capture all actions with user, timestamp, reason
2. ✅ Section 5.3: Strong password policy enforced
3. ✅ Section 5.3: Session timeout after 30 minutes
4. ✅ Section 5.7: 15-year audit log retention
5. ✅ PDPA No. 9 of 2022: Data access logs for patient records
6. ✅ HIPAA-compliant audit trails
7. ✅ Medical records retention minimum 6-7 years

---

## PHASE 6: Performance Optimization & Final Testing
**Duration:** 3-4 days
**Priority:** MEDIUM
**Dependencies:** All previous phases

### Objectives
- Performance tuning for 50+ concurrent users
- Database query optimization
- Load testing and stress testing
- Final integration testing
- User acceptance testing (UAT)

### Tasks

#### 6.1 Database Query Optimization
**File:** `backend/migrations/performance_indexes.sql`

```sql
-- Create compound indexes for frequently joined queries
CREATE INDEX IF NOT EXISTS idx_appointment_doctor_status_date
  ON appointment(doctor_id, status, schedule_date);

CREATE INDEX IF NOT EXISTS idx_appointment_treatment_composite
  ON appointment_treatment(appointment_id, service_code);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_timestamp
  ON audit_log(user_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_data_access_log_user_patient
  ON data_access_log(user_id, patient_id, timestamp);

-- Add covering indexes for common queries
CREATE INDEX IF NOT EXISTS idx_patient_insurance
  ON patient(insurance_provider_id, patient_id);

-- Analyze tables for query optimization
ANALYZE TABLE appointment;
ANALYZE TABLE appointment_treatment;
ANALYZE TABLE patient;
ANALYZE TABLE audit_log;
ANALYZE TABLE data_access_log;

-- Create materialized view for doctor stats (optional, for very high load)
-- CREATE TABLE doctor_stats_cache AS
-- SELECT
--   doctor_id,
--   COUNT(*) as total_appointments,
--   SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
--   DATE(schedule_date) as date
-- FROM appointment
-- GROUP BY doctor_id, DATE(schedule_date);
```

#### 6.2 API Response Time Optimization
**File:** `backend/middleware/performanceMonitor.js`

```javascript
// Monitor API response times (Section 5.1: 2-3 seconds for queries)
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    if (duration > 3000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms`);

      // Log to performance metrics table (optional)
      // logPerformanceMetric(req.path, duration);
    }
  });

  next();
};

module.exports = performanceMonitor;
```

#### 6.3 Load Testing Script
**File:** `tests/load-test.js`

```javascript
// Load testing with 50+ concurrent users (Section 5.1 requirement)
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const DOCTOR_TOKEN = 'YOUR_TEST_TOKEN';
const NUM_CONCURRENT_USERS = 50;

async function simulateDoctorWorkflow(userId) {
  const start = Date.now();

  try {
    // 1. Load dashboard stats
    await axios.get(`${BASE_URL}/api/doctor/stats`, {
      headers: { 'Authorization': `Bearer ${DOCTOR_TOKEN}` }
    });

    // 2. Load today's appointments
    await axios.get(`${BASE_URL}/api/doctor/appointments/today`, {
      headers: { 'Authorization': `Bearer ${DOCTOR_TOKEN}` }
    });

    // 3. Load treatment catalogue
    await axios.get(`${BASE_URL}/api/doctor/treatments/catalogue`, {
      headers: { 'Authorization': `Bearer ${DOCTOR_TOKEN}` }
    });

    // 4. Update appointment status
    await axios.put(`${BASE_URL}/api/doctor/appointments/1/status`,
      { status: 'Completed' },
      { headers: { 'Authorization': `Bearer ${DOCTOR_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    // 5. Add treatment
    await axios.post(`${BASE_URL}/api/doctor/appointments/1/treatments`,
      { service_code: 'CONS-GEN', actual_price: 50.00 },
      { headers: { 'Authorization': `Bearer ${DOCTOR_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    const duration = Date.now() - start;
    console.log(`User ${userId} completed workflow in ${duration}ms`);

    return { userId, duration, success: true };

  } catch (error) {
    console.error(`User ${userId} failed:`, error.message);
    return { userId, success: false, error: error.message };
  }
}

async function runLoadTest() {
  console.log(`Starting load test with ${NUM_CONCURRENT_USERS} concurrent users...`);

  const promises = [];
  for (let i = 1; i <= NUM_CONCURRENT_USERS; i++) {
    promises.push(simulateDoctorWorkflow(i));
  }

  const results = await Promise.all(promises);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;

  console.log('\n=== LOAD TEST RESULTS ===');
  console.log(`Total users: ${NUM_CONCURRENT_USERS}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Average duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`Max duration: ${Math.max(...successful.map(r => r.duration))}ms`);
  console.log(`Min duration: ${Math.min(...successful.map(r => r.duration))}ms`);

  // Check performance requirements (Section 5.1: 2-3 seconds)
  if (avgDuration > 3000) {
    console.log('❌ FAILED: Average response time exceeds 3 seconds');
  } else {
    console.log('✅ PASSED: Performance within acceptable range');
  }
}

runLoadTest();
```

**Run load test:**
```bash
cd backend
npm install axios
node tests/load-test.js
```

#### 6.4 Integration Test Suite
**File:** `tests/doctor-portal-integration.test.js`

```javascript
// Integration tests for doctor portal
const assert = require('assert');
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let doctorToken;
let testAppointmentId;

describe('Doctor Portal Integration Tests', () => {

  before(async () => {
    // Login as doctor
    const response = await axios.post(`${BASE_URL}/api/login`, {
      username: 'doc1',
      password: 'test-password'
    });
    doctorToken = response.data.token;
  });

  it('Should fetch doctor profile', async () => {
    const response = await axios.get(`${BASE_URL}/api/doctor/profile`, {
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });

    assert.strictEqual(response.status, 200);
    assert.ok(response.data.name);
  });

  it('Should fetch today appointments', async () => {
    const response = await axios.get(`${BASE_URL}/api/doctor/appointments/today`, {
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });

    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.data));
  });

  it('Should NOT allow adding treatment to scheduled appointment', async () => {
    try {
      await axios.post(`${BASE_URL}/api/doctor/appointments/${testAppointmentId}/treatments`,
        { service_code: 'CONS-GEN' },
        { headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' } }
      );
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.strictEqual(error.response.status, 400);
      assert.ok(error.response.data.message.includes('completed'));
    }
  });

  it('Should mark appointment as completed', async () => {
    const response = await axios.put(`${BASE_URL}/api/doctor/appointments/${testAppointmentId}/status`,
      { status: 'Completed' },
      { headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' } }
    );

    assert.strictEqual(response.status, 200);
  });

  it('Should add treatment to completed appointment', async () => {
    const response = await axios.post(`${BASE_URL}/api/doctor/appointments/${testAppointmentId}/treatments`,
      { service_code: 'CONS-GEN', actual_price: 50.00, notes: 'Test treatment' },
      { headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' } }
    );

    assert.strictEqual(response.status, 201);
  });

  it('Should save consultation notes', async () => {
    const response = await axios.put(`${BASE_URL}/api/doctor/appointments/${testAppointmentId}/notes`,
      { consultation_notes: 'Patient presents with...' },
      { headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' } }
    );

    assert.strictEqual(response.status, 200);
    assert.ok(response.data.saved_at);
  });

  it('Should generate revenue report', async () => {
    const response = await axios.get(
      `${BASE_URL}/api/doctor/reports/revenue?startDate=2025-01-01&endDate=2025-12-31`,
      { headers: { 'Authorization': `Bearer ${doctorToken}` } }
    );

    assert.strictEqual(response.status, 200);
    assert.ok(response.data.summary);
    assert.ok(response.data.treatments);
  });

  it('Should verify audit log entry created', async () => {
    // This would require admin token, or check via direct DB query
    // Verify that audit_log has entries for the doctor's actions
  });
});

// Run tests
describe.run();
```

### Phase 6 Testing Checklist

**Performance Tests:**
- [ ] Response time < 3 seconds for all API endpoints
- [ ] Support 50+ concurrent users without errors
- [ ] Appointment operations complete within 2 seconds
- [ ] Report generation < 10 seconds for 10,000 records
- [ ] Database queries use appropriate indexes
- [ ] No N+1 query problems

**Integration Tests:**
- [ ] Complete doctor workflow: login → view appointments → mark complete → add treatments → save notes
- [ ] Business rule enforced: treatments only on completed appointments
- [ ] Auto-save works correctly (every 30 seconds)
- [ ] Reports generate accurate data
- [ ] Audit logs created for all actions
- [ ] Session timeout works correctly

**User Acceptance Testing (UAT):**
- [ ] Doctor can view all appointments
- [ ] Color-coded status indicators visible
- [ ] Treatment selector shows catalogue correctly
- [ ] Consultation notes auto-save without data loss
- [ ] Medical history displays correctly
- [ ] Reports render with accurate data
- [ ] Mobile responsive design works
- [ ] No console errors in browser

### Phase 6 Deliverables
- ✅ Performance optimization indexes
- ✅ Load testing results (50+ concurrent users)
- ✅ Integration test suite
- ✅ Performance monitoring dashboard
- ✅ UAT sign-off document
- ✅ Deployment documentation

### Phase 6 Acceptance Criteria
1. ✅ Section 5.1: Response time 2-3 seconds for database queries
2. ✅ Section 5.1: Support 50+ concurrent users
3. ✅ Section 5.1: Appointment operations within 2 seconds
4. ✅ Section 5.1: Report generation within 10 seconds for 10,000 records
5. ✅ Section 5.1: 99% uptime during clinic hours (deployment monitoring)
6. ✅ All requirements from Phases 1-5 verified
7. ✅ No critical bugs in production

---

## Summary of API Endpoints

### Existing Endpoints (Already Implemented)
1. `GET /api/doctor/profile` - Get doctor profile
2. `GET /api/doctor/appointments/today` - Today's appointments
3. `GET /api/doctor/appointments/upcoming` - Upcoming appointments
4. `GET /api/doctor/appointments/search` - Search appointments with filters
5. `PUT /api/doctor/appointments/:appointmentId/status` - Update appointment status
6. `GET /api/doctor/stats` - Dashboard statistics
7. `GET /api/doctor/patients/:patientId` - Patient details
8. `GET /api/doctor/patients/:patientId/history` - Patient appointment history

### New Endpoints to Build

**Phase 2 - Clinical Documentation:**
9. `GET /api/doctor/treatments/catalogue` - Get all active treatments
10. `GET /api/doctor/treatments/catalogue/category/:category` - Get treatments by category
11. `GET /api/doctor/treatments/categories` - Get all categories
12. `GET /api/doctor/appointments/:appointmentId/treatments` - Get treatments for appointment
13. `POST /api/doctor/appointments/:appointmentId/treatments` - Add treatment (REQ-4.4.1)
14. `DELETE /api/doctor/appointments/:appointmentId/treatments/:serviceCode` - Remove treatment
15. `GET /api/doctor/appointments/:appointmentId/notes` - Get consultation notes
16. `PUT /api/doctor/appointments/:appointmentId/notes` - Update consultation notes (auto-save)
17. `GET /api/doctor/patients/:patientId/medical-history` - Get medical history
18. `PUT /api/doctor/patients/:patientId/medical-history` - Update medical history

**Phase 4 - Reports:**
19. `GET /api/doctor/reports/revenue` - Doctor-wise revenue report (REQ-4.7.2)
20. `GET /api/doctor/reports/treatments-by-category` - Treatments per category (REQ-4.7.4)
21. `GET /api/doctor/reports/appointment-summary` - Appointment summary report

**Phase 5 - Admin/Compliance:**
22. `GET /api/admin/audit-logs` - View audit logs (admin only)
23. `GET /api/admin/data-access-logs` - View data access logs (admin only)

---

## Testing Strategy Summary

### Unit Tests
- Business rule enforcement (treatments only for completed appointments)
- Password policy validation
- Date range validation
- Price calculation accuracy

### Integration Tests
- Complete doctor workflow from login to treatment recording
- Audit logging verification
- Session management and timeout
- Report generation accuracy

### Performance Tests
- Load testing with 50+ concurrent users
- Response time measurement for all endpoints
- Database query performance analysis
- Auto-save performance under load

### Security Tests
- Session timeout verification
- Audit log immutability
- Excessive access detection
- Password policy enforcement
- PDPA compliance verification

### User Acceptance Tests
- Complete user workflows with real doctors
- UI/UX feedback
- Mobile responsiveness
- Error handling and recovery

---

## Deployment Checklist

1. **Database Setup:**
   - [ ] Run base_schema.sql
   - [ ] Run clinical_documentation_migration.sql
   - [ ] Run performance_indexes.sql
   - [ ] Verify all tables created
   - [ ] Verify all indexes created

2. **Backend Setup:**
   - [ ] Install dependencies: `npm install`
   - [ ] Configure .env file with correct credentials
   - [ ] Apply middleware: auditLogger, sessionManager, pdpaLogger, performanceMonitor
   - [ ] Start server: `node server.js`
   - [ ] Verify API endpoints respond

3. **Frontend Deployment:**
   - [ ] Copy all HTML/JS/CSS files to web server
   - [ ] Update API base URL in JavaScript files
   - [ ] Test authentication flow
   - [ ] Verify all pages load correctly

4. **Security Configuration:**
   - [ ] Enable HTTPS/TLS
   - [ ] Configure firewall rules
   - [ ] Set up log rotation for audit logs
   - [ ] Configure backup schedules (daily recommended)
   - [ ] Enable database encryption at rest

5. **Monitoring:**
   - [ ] Set up application monitoring (uptime, errors)
   - [ ] Configure database performance monitoring
   - [ ] Set up alerts for excessive access patterns
   - [ ] Create dashboard for audit log review

6. **Documentation:**
   - [ ] User manual for doctors
   - [ ] API documentation
   - [ ] System architecture diagram
   - [ ] Disaster recovery procedures
   - [ ] Compliance audit report

---

## Compliance & Regulatory Requirements

### Sri Lanka PDPA No. 9 of 2022
- ✅ Patient data access logging
- ✅ Consent management (implicit through appointment system)
- ✅ Data retention policies (15 years for audit logs, 7 years for medical records)
- ✅ Right to access (patients can view their records)
- ✅ Security safeguards (encryption, audit trails)

### HIPAA Compliance (if applicable)
- ✅ Access controls (role-based authorization)
- ✅ Audit trails for all PHI access
- ✅ Encryption at rest and in transit
- ✅ Session timeout after inactivity
- ✅ Minimum necessary access principle

### Medical Records Retention
- ✅ Minimum 6-7 years retention (Section 5.7)
- ✅ Audit logs retained for 15 years
- ✅ Soft delete with archived flag for records

---

## Risk Mitigation

### High Priority Risks
1. **Data Breach:**
   - Mitigation: Encryption, audit logging, excessive access detection, PDPA compliance

2. **Performance Degradation:**
   - Mitigation: Database indexing, caching, load testing, performance monitoring

3. **Business Rule Violation (treatments on non-completed appointments):**
   - Mitigation: Database constraints, API-level validation, UI-level blocking

4. **Audit Log Loss:**
   - Mitigation: Immutable logs, regular backups, 15-year retention

### Medium Priority Risks
5. **Session Hijacking:**
   - Mitigation: 30-minute timeout, secure token storage, HTTPS only

6. **Auto-Save Data Loss:**
   - Mitigation: Error recovery, local storage backup, visual save status

---

## Success Metrics

### Technical Metrics
- API response time < 3 seconds (95th percentile)
- 99% uptime during clinic hours
- Zero data loss incidents
- 100% audit log coverage for doctor actions

### User Metrics
- Doctor satisfaction score > 4/5
- Average time to complete workflow < 5 minutes
- Error rate < 1% of all transactions

### Compliance Metrics
- 100% of patient data access logged
- Zero compliance violations
- Audit logs retrievable within 24 hours for investigations

---

## Conclusion

This implementation plan provides a comprehensive, phase-based approach to building the Doctor Portal for the CATMS system. Each phase has clear objectives, testable milestones, and acceptance criteria aligned with the functional, security, and regulatory requirements.

**Total Estimated Duration:** 25-30 days
**Critical Path:** Phases 1 → 2 → 3 (Clinical Documentation System)
**Priority Order:** Phase 2 > Phase 1 > Phase 5 > Phase 3 > Phase 4 > Phase 6

The plan emphasizes:
1. **Clinical Documentation** as the primary feature (REQ-4.4.1-4.4.5)
2. **Security & Compliance** (PDPA, HIPAA, audit logging)
3. **Performance** (50+ concurrent users, sub-3-second response times)
4. **Testability** (every milestone has clear test criteria)

Proceed with Phase 1 to establish the security foundation, then move to Phase 2 for the core clinical documentation features.
