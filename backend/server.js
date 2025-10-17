// server.js

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

// Import Phase 1 middleware
const auditLogger = require('./middleware/auditLogger');
const { sessionManager, createSession, destroySession } = require('./middleware/sessionManager');

const app = express();
const PORT = process.env.PORT || 3000;

// --- DATABASE CONFIGURATION ---
const dbConfig = {
    host: "localhost",
    user: "root",
    password: "Lekshan123@", // ⚠️ Replace with your MySQL password
    database: "hospital_managment", // Replace with your database name if different
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Apply Phase 1 Security Middleware
app.use(auditLogger(pool)); // Logs all doctor actions to audit_log
app.use(sessionManager(pool)); // Enforces 30-minute session timeout

// --- UTILITY FUNCTION for error handling ---
const handleDatabaseError = (res, err) => {
    console.error("Database Error:", err);
    res.status(500).json({ error: "An internal server error occurred." });
};

<<<<<<< Updated upstream
// --- GENERIC CRUD Endpoints ---
=======
// --- AUTHENTICATION & AUTHORIZATION ---

// Authorization Middleware
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authentication token required.' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded; // { userId, role }

            const userRoleLower = req.user.role.toLowerCase();
            const allowedRolesLower = allowedRoles.map(r => r.toLowerCase());

            if (allowedRolesLower.includes(userRoleLower)) {  // ✅ Using lowercase arrays
                next();  // User has the required role, proceed
            } else {
                res.status(403).json({ message: 'Forbidden: You do not have permission.' });
            }
        } catch (err) {
            res.status(401).json({ message: 'Invalid or expired token.' });
        }
    };
};

// Login Endpoint
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }
    try {
        const [rows] = await pool.query(`
            SELECT ai.user_id, ai.username, ai.password_hash, r.name as role
            FROM Account_Info ai
            JOIN Role r ON ai.role_id = r.role_id
            WHERE ai.username = ?
        `, [username]);

        if (rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const user = rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const token = jwt.sign(
            { userId: user.user_id, role: user.role.toLowerCase() },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Create session for tracking and timeout enforcement
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        await createSession(pool, user.user_id, token, ipAddress, userAgent);

        res.json({ message: "Login successful", token, role: user.role.toLowerCase() });

    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// Logout Endpoint
app.post("/api/logout", authorize(['admin', 'doctor', 'receptionist', 'branch manager']), async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const userId = req.user.userId;

        // Destroy session
        const destroyed = await destroySession(pool, userId, token);

        if (destroyed) {
            res.json({ message: "Logout successful" });
        } else {
            res.status(404).json({ message: "Session not found" });
        }
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// --- GENERIC CRUD Endpoints (Protected for Admins) ---
>>>>>>> Stashed changes
const createCrudEndpoints = (entityName, tableName, idColumn) => {
    const endpoint = `/api/${entityName}`;
    app.get(endpoint, async (req, res) => {
        try { const [rows] = await pool.query(`SELECT * FROM ${tableName}`); res.json(rows); } 
        catch (err) { handleDatabaseError(res, err); }
    });
    app.get(`${endpoint}/:id`, async (req, res) => {
        try {
            const [rows] = await pool.query(`SELECT * FROM ${tableName} WHERE ${idColumn} = ?`, [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ error: `${entityName} not found` });
            res.json(rows[0]);
        } catch (err) { handleDatabaseError(res, err); }
    });
    app.post(endpoint, async (req, res) => {
        try {
            const columns = Object.keys(req.body).join(', ');
            const placeholders = Object.keys(req.body).map(() => '?').join(', ');
            const values = Object.values(req.body);
            await pool.query(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`, values);
            res.status(201).json({ message: `${entityName} created successfully` });
        } catch (err) { handleDatabaseError(res, err); }
    });
    app.put(`${endpoint}/:id`, async (req, res) => {
        try {
            const updates = Object.keys(req.body).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(req.body), req.params.id];
            await pool.query(`UPDATE ${tableName} SET ${updates} WHERE ${idColumn} = ?`, values);
            res.status(200).json({ message: `${entityName} updated successfully` });
        } catch (err) { handleDatabaseError(res, err); }
    });
    app.delete(`${endpoint}/:id`, async (req, res) => {
        try {
            await pool.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [req.params.id]);
            res.status(204).send();
        } catch (err) { handleDatabaseError(res, err); }
    });
};

// --- API ROUTES ---

// --- GET Lists for Forms ---
app.get("/api/list/:type", async (req, res) => {
    const { type } = req.params;
    let query;
    try {
        switch (type) {
            case "patients": query = "SELECT patient_id, name FROM Patient ORDER BY name"; break;
            case "doctors": query = "SELECT d.doctor_id, s.name FROM Doctor d JOIN Staff s ON d.staff_id = s.staff_id ORDER BY s.name"; break;
            case "branches": query = "SELECT branch_id, name FROM Branch ORDER BY name"; break;
            case "roles": query = "SELECT role_id, name FROM Role ORDER BY name"; break;
            case "insurance-providers": query = "SELECT id, name FROM Insurance_Provider ORDER BY name"; break;
            default: return res.status(404).json({ error: "List type not found" });
        }
        const [results] = await pool.query(query);
        res.json(results);
    } catch (err) { handleDatabaseError(res, err); }
});

// --- Dashboard Stats Endpoints ---
app.get("/api/stats/treatment-distribution", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT tc.name, COUNT(at.service_code) as count
            FROM Appointment_Treatment at
            JOIN Treatment_Catalogue tc ON at.service_code = tc.service_code
            GROUP BY tc.name ORDER BY count DESC LIMIT 5;
        `);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

app.get("/api/stats/daily-patients", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT DATE(schedule_date) as date, COUNT(DISTINCT patient_id) as count
            FROM Appointment
            WHERE schedule_date >= CURDATE() - INTERVAL 7 DAY
            GROUP BY DATE(schedule_date) ORDER BY date ASC;
        `);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

app.get("/api/stats/summary", async (req, res) => {
    try {
        const [[{ patients }]] = await pool.query("SELECT COUNT(*) as patients FROM Patient");
        const [[{ appointments }]] = await pool.query("SELECT COUNT(*) as appointments FROM Appointment WHERE status = 'Scheduled'");
        const [[{ doctors }]] = await pool.query("SELECT COUNT(*) as doctors FROM Doctor");
        res.json({ patients, appointments, doctors });
    } catch (err) { handleDatabaseError(res, err); }
});

// --- Specific Endpoints (for complex queries) ---
app.get("/api/patients", async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT *, TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age FROM Patient ORDER BY name`);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});
// Note: We are overriding the generic GET /api/patients with the one above, but using the generic POST, PUT, DELETE.
createCrudEndpoints('patients', 'Patient', 'patient_id');

app.get("/api/appointments", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT a.*, p.name as patient_name, s.name as doctor_name, b.name as branch_name
            FROM Appointment a
            JOIN Patient p ON a.patient_id = p.patient_id
            JOIN Doctor d ON a.doctor_id = d.doctor_id
            JOIN Staff s ON d.staff_id = s.staff_id
            JOIN Branch b ON a.branch_id = b.branch_id
            ORDER BY a.schedule_date DESC`);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});
createCrudEndpoints('appointments', 'Appointment', 'appointment_id');

app.get("/api/doctors", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.doctor_id, s.name, s.contact_info, b.name as branch_name
            FROM Doctor d
            JOIN Staff s ON d.staff_id = s.staff_id
            JOIN Branch b ON s.branch_id = b.branch_id
            ORDER BY s.name`);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

app.get("/api/staff", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT s.*, r.name as role_name, b.name as branch_name
            FROM Staff s
            JOIN Account_Info ai ON s.user_id = ai.user_id
            JOIN Role r ON ai.role_id = r.role_id
            JOIN Branch b ON s.branch_id = b.branch_id
            ORDER BY s.name`);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

app.post("/api/staff", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { name, contact_info, branch_id, role_id, username, email, is_medical_staff } = req.body;
        // In a real app, use a library like bcrypt to hash passwords securely
        const password_hash = "placeholder_hash"; 
        const [accountResult] = await connection.query("INSERT INTO Account_Info (role_id, username, password_hash, email) VALUES (?, ?, ?, ?)", [role_id, username, password_hash, email]);
        const newUserId = accountResult.insertId;
        await connection.query("INSERT INTO Staff (user_id, name, contact_info, is_medical_staff, branch_id) VALUES (?, ?, ?, ?, ?)", [newUserId, name, contact_info, is_medical_staff === '1', branch_id]);
        await connection.commit();
        res.status(201).json({ message: "Staff created successfully" });
    } catch (err) {
        await connection.rollback();
        handleDatabaseError(res, err);
    } finally {
        connection.release();
    }
});

app.get("/api/invoices", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT i.*, p.name as patient_name, (i.total_amount - (SELECT IFNULL(SUM(paid_amount), 0) FROM Payment WHERE invoice_id = i.invoice_id)) as outstanding_balance
            FROM Invoice i
            JOIN Appointment a ON i.appointment_id = a.appointment_id
            JOIN Patient p ON a.patient_id = p.patient_id
            ORDER BY i.issued_date DESC`);
        res.json(rows);
    } catch(err) { handleDatabaseError(res, err); }
});

app.get("/api/payments/by-invoice/:invoiceId", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM Payment WHERE invoice_id = ?", [req.params.invoiceId]);
        res.json(rows);
    } catch(err) { handleDatabaseError(res, err); }
});

app.post("/api/payments", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { invoice_id, paid_amount, payment_date, method_of_payment, status } = req.body;
        await connection.query("INSERT INTO Payment (invoice_id, paid_amount, payment_date, method_of_payment, status) VALUES (?, ?, ?, ?, ?)", [invoice_id, paid_amount, payment_date, method_of_payment, status]);
        
        const [[invoice]] = await connection.query(`
            SELECT total_amount, 
                   (SELECT IFNULL(SUM(paid_amount), 0) FROM Payment WHERE invoice_id = ?) as total_paid 
            FROM Invoice 
            WHERE invoice_id = ?`, 
            [invoice_id, invoice_id]);
        
        let newStatus = 'Partially Paid';
        if (parseFloat(invoice.total_paid) >= parseFloat(invoice.total_amount)) {
            newStatus = 'Paid';
        }
        
        await connection.query("UPDATE Invoice SET status = ? WHERE invoice_id = ?", [newStatus, invoice_id]);
        await connection.commit();
        res.status(201).json({ message: "Payment recorded" });
    } catch(err) { 
        await connection.rollback();
        handleDatabaseError(res, err); 
    } finally {
        connection.release();
    }
});

// Registering remaining generic CRUD endpoints
createCrudEndpoints('branches', 'Branch', 'branch_id');
createCrudEndpoints('insurance-providers', 'Insurance_Provider', 'id');
createCrudEndpoints('treatments', 'Treatment_Catalogue', 'service_code');
createCrudEndpoints('specialties', 'Specialties', 'specialty_id');

<<<<<<< Updated upstream
=======
// =========================================================================================
// --- DOCTOR-SPECIFIC API Endpoints ---
const getDoctorInfoFromToken = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const [rows] = await pool.query(`SELECT d.doctor_id FROM Doctor d JOIN Staff s ON d.staff_id = s.staff_id WHERE s.user_id = ?`, [userId]);
        if (rows.length === 0) {
            return res.status(403).json({ message: "Forbidden: The logged-in user is not a doctor." });
        }
        req.doctorId = rows[0].doctor_id;
        next();
    } catch (err) {
        handleDatabaseError(res, err);
    }
};

app.get("/api/doctor/profile", authorize(['doctor']), async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await pool.query(
            `SELECT name FROM Staff WHERE user_id = ?`,
            [userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: "Staff profile not found for this user." });
        }
        res.json(rows[0]);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

const APPOINTMENT_BASE_QUERY = `SELECT a.appointment_id, a.patient_id, a.schedule_date, a.status, p.name as patient_name, p.contact_info as patient_contact, TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) as patient_age, ip.name as insurance_provider FROM Appointment a JOIN Patient p ON a.patient_id = p.patient_id LEFT JOIN Insurance_Provider ip ON p.insurance_provider_id = ip.id`;

app.get("/api/doctor/appointments/today", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
    try {
        const query = `${APPOINTMENT_BASE_QUERY} WHERE a.doctor_id = ? AND DATE(a.schedule_date) = CURDATE() ORDER BY a.schedule_date ASC`;
        const [rows] = await pool.query(query, [req.doctorId]);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

app.get("/api/doctor/appointments/upcoming", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
    try {
        const query = `${APPOINTMENT_BASE_QUERY} WHERE a.doctor_id = ? AND DATE(a.schedule_date) > CURDATE() ORDER BY a.schedule_date ASC`;
        const [rows] = await pool.query(query, [req.doctorId]);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

app.get("/api/doctor/appointments/search", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
    try {
        let conditions = " WHERE a.doctor_id = ? ";
        const params = [req.doctorId];
        if (req.query.query) {
            conditions += " AND p.name LIKE ? ";
            params.push(`%${req.query.query}%`);
        }
        if (req.query.startDate && req.query.endDate) {
            conditions += " AND DATE(a.schedule_date) BETWEEN ? AND ? ";
            params.push(req.query.startDate, req.query.endDate);
        }
        const query = `${APPOINTMENT_BASE_QUERY} ${conditions} ORDER BY a.schedule_date ASC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

app.put("/api/doctor/appointments/:appointmentId/status", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
    try {
        const { status } = req.body;
        const { appointmentId } = req.params;
        if (!status) { return res.status(400).json({ message: "Status is required." }); }
        await pool.query("UPDATE Appointment SET status = ? WHERE appointment_id = ? AND doctor_id = ?", [status, appointmentId, req.doctorId]);
        res.json({ message: "Status updated successfully." });
    } catch (err) { handleDatabaseError(res, err); }
});

app.get("/api/doctor/stats", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
    try {
        const [[todayStats]] = await pool.query(`SELECT COUNT(*) as total_appointments, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled FROM Appointment WHERE doctor_id = ? AND DATE(schedule_date) = CURDATE()`, [req.doctorId]);
        const [[{ upcoming_week }]] = await pool.query(`SELECT COUNT(*) as upcoming_week FROM Appointment WHERE doctor_id = ? AND schedule_date BETWEEN CURDATE() + INTERVAL 1 DAY AND CURDATE() + INTERVAL 7 DAY`, [req.doctorId]);
        res.json({ today: todayStats || { total_appointments: 0, completed: 0, scheduled: 0 }, upcoming_week: upcoming_week || 0 });
    } catch (err) { handleDatabaseError(res, err); }
});

app.get("/api/doctor/patients/:patientId", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT p.*, TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age, ip.name as insurance_provider_name FROM Patient p LEFT JOIN Insurance_Provider ip ON p.insurance_provider_id = ip.id WHERE p.patient_id = ?`, [req.params.patientId]);
        if (rows.length === 0) return res.status(404).json({ message: "Patient not found." });
        res.json(rows[0]);
    } catch (err) { handleDatabaseError(res, err); }
});

app.get("/api/doctor/patients/:patientId/history", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT a.appointment_id, a.schedule_date, a.status, a.is_emergency, i.total_amount as total_cost, (SELECT GROUP_CONCAT(tc.name SEPARATOR ', ') FROM Appointment_Treatment at JOIN Treatment_Catalogue tc ON at.service_code = tc.service_code WHERE at.appointment_id = a.appointment_id) as treatments FROM Appointment a LEFT JOIN Invoice i ON a.appointment_id = i.appointment_id WHERE a.patient_id = ? AND a.doctor_id = ? ORDER BY a.schedule_date DESC`, [req.params.patientId, req.doctorId]);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

// =========================================================================================
// --- PHASE 2: CLINICAL DOCUMENTATION API ENDPOINTS ---
// =========================================================================================

// ============ TREATMENT CATALOGUE ENDPOINTS ============

// GET all active treatments from catalogue
app.get("/api/doctor/treatments/catalogue", authorize(['doctor']), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT service_code, name, description, price as base_price
            FROM treatment_catalogue
            ORDER BY name
        `);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

// GET treatments by name search (kept for compatibility)
app.get("/api/doctor/treatments/catalogue/search", authorize(['doctor']), async (req, res) => {
    try {
        const { query } = req.query;
        const [rows] = await pool.query(`
            SELECT service_code, name, description, price as base_price
            FROM treatment_catalogue
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY name
        `, [`%${query}%`, `%${query}%`]);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});

// GET treatment by service code
app.get("/api/doctor/treatments/catalogue/:serviceCode", authorize(['doctor']), async (req, res) => {
    try {
        const [[row]] = await pool.query(`
            SELECT service_code, name, description, price as base_price
            FROM treatment_catalogue
            WHERE service_code = ?
        `, [req.params.serviceCode]);

        if (!row) {
            return res.status(404).json({ message: 'Treatment not found' });
        }
        res.json(row);
    } catch (err) { handleDatabaseError(res, err); }
});

// ============ TREATMENT RECORDING ENDPOINTS (REQ-4.4.1) ============

// GET treatments for a specific appointment
app.get("/api/doctor/appointments/:appointmentId/treatments", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
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
    } catch (err) { handleDatabaseError(res, err); }
});

// POST - Add treatment to appointment (CRITICAL BUSINESS RULE: Only for completed appointments)
app.post("/api/doctor/appointments/:appointmentId/treatments", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
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
app.delete("/api/doctor/appointments/:appointmentId/treatments/:serviceCode", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
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
    } catch (err) { handleDatabaseError(res, err); }
});

// ============ CONSULTATION NOTES ENDPOINTS (AUTO-SAVE SUPPORT) ============

// GET consultation notes for appointment
app.get("/api/doctor/appointments/:appointmentId/notes", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
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
            can_edit: true  // Doctors can always edit notes
        });
    } catch (err) { handleDatabaseError(res, err); }
});

// PUT - Update consultation notes (supports auto-save)
app.put("/api/doctor/appointments/:appointmentId/notes", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
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

    } catch (err) { handleDatabaseError(res, err); }
});

// ============ MEDICAL HISTORY ENDPOINTS ============

// GET patient medical history (allergies, medications, history)
app.get("/api/doctor/patients/:patientId/medical-history", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
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
    } catch (err) { handleDatabaseError(res, err); }
});

// UPDATE patient medical history (doctors can update)
app.put("/api/doctor/patients/:patientId/medical-history", authorize(['doctor']), getDoctorInfoFromToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        const { medical_history, allergies, current_medications } = req.body;

        await pool.query(`
            UPDATE patient
            SET medical_history = ?, allergies = ?, current_medications = ?
            WHERE patient_id = ?
        `, [medical_history, allergies, current_medications, patientId]);

        res.json({ message: 'Medical history updated successfully' });
    } catch (err) { handleDatabaseError(res, err); }
});

// =========================================================================================
// --- END OF PHASE 2 CLINICAL DOCUMENTATION API ---
// =========================================================================================

// Branch CRUD (Admin only)
app.get("/api/branches", authorize(['admin']), async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Branch`);
        res.json(rows);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// GET a single branch by ID (replaces generic handler)
app.get("/api/branches/:id", authorize(['admin']), async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Branch WHERE branch_id = ?`, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: `Branch not found` });
        res.json(rows[0]);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});


// *** NEW: Custom POST endpoint for creating a Branch and its Manager ***
app.post("/api/branches", authorize(['admin']), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Extract all data from the request body
        const {
            name, address, contact_number, // Branch details
            manager_name, manager_contact_info, manager_username, manager_email, manager_password // Manager details
        } = req.body;

        // 2. Find the role_id for "Branch Manager"
        const [[managerRole]] = await connection.query("SELECT role_id FROM Role WHERE name = 'Branch Manager' LIMIT 1");
        if (!managerRole) {
            throw new Error("The 'Branch Manager' role does not exist in the database.");
        }

        // 3. Create the Account_Info record for the manager
        if (!manager_password) throw new Error("Password is required for the new manager.");
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(manager_password, salt);
        const [accountResult] = await connection.query(
            "INSERT INTO Account_Info (role_id, username, password_hash, email) VALUES (?, ?, ?, ?)",
            [managerRole.role_id, manager_username, password_hash, manager_email]
        );
        const newUserId = accountResult.insertId;

        // 4. ✅ CREATE THE STAFF RECORD FIRST (with branch_id as NULL)
        // This makes the user_id valid for the foreign key constraint.
        await connection.query(
            "INSERT INTO Staff (user_id, name, contact_info, is_medical_staff, branch_id) VALUES (?, ?, ?, ?, NULL)",
            [newUserId, manager_name, manager_contact_info, false]
        );

        // 5. ✅ NOW, CREATE THE BRANCH, linking the new manager's user_id
        const [branchResult] = await connection.query(
            "INSERT INTO Branch (name, address, contact_number, manager_user_id) VALUES (?, ?, ?, ?)",
            [name, address, contact_number, newUserId]
        );
        const newBranchId = branchResult.insertId;

        // 6. ✅ FINALLY, UPDATE the manager's staff record with the new branch_id
        await connection.query(
            "UPDATE Staff SET branch_id = ? WHERE user_id = ?",
            [newBranchId, newUserId]
        );

        // 7. If all steps succeed, commit the transaction
        await connection.commit();
        res.status(201).json({ message: "Branch and Branch Manager created successfully." });

    } catch (err) {
        await connection.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'The username or email for the manager already exists.' });
        }
        console.error("Error creating branch:", err);
        res.status(500).json({ error: err.message || "An internal server error occurred." });
    } finally {
        connection.release();
    }
});

// PUT (update) a branch (replaces generic handler)
app.put("/api/branches/:id", authorize(['admin']), async (req, res) => {
    try {
        const updates = Object.keys(req.body).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(req.body), req.params.id];
        await pool.query(`UPDATE Branch SET ${updates} WHERE branch_id = ?`, values);
        res.status(200).json({ message: `Branch updated successfully` });
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// DELETE a branch (replaces generic handler)
app.delete("/api/branches/:id", authorize(['admin']), async (req, res) => {
    try {
        // Note: Deleting a branch might fail if a manager or staff is linked to it,
        // depending on your foreign key constraints. Proper deletion logic
        // would require handling or re-assigning associated staff.
        await pool.query(`DELETE FROM Branch WHERE branch_id = ?`, [req.params.id]);
        res.status(204).send();
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// server.js

// GET a list of all staff members with the 'Branch Manager' role

// =========================================================================================
// --- BRANCH MANAGER-SPECIFIC API Endpoints ---
// =========================================================================================

// Middleware to get the manager's branch_id and attach it to the request
// FIX: This function must be defined BEFORE any routes that use it to prevent a ReferenceError.
const getBranchInfoFromToken = async (req, res, next) => {
    try {
        const userId = req.user.userId; // This comes from the 'authorize' middleware
        const [rows] = await pool.query(
            `SELECT s.branch_id, b.name as branch_name FROM Staff s JOIN Branch b ON s.branch_id = b.branch_id WHERE s.user_id = ?`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(403).json({ message: "Forbidden: You are not assigned as a manager to any branch." });
        }

        req.branchId = rows[0].branch_id;
        req.branchName = rows[0].branch_name;
        next(); // Proceed to the actual route handler
    } catch (err) {
        handleDatabaseError(res, err);
    }
};
// GET single staff member details for editing
app.get("/api/branch-manager/staff/:id", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const staffId = req.params.id;

        const [rows] = await pool.query(`
            SELECT s.staff_id, s.name, s.contact_info, s.is_medical_staff, r.name as role_name 
            FROM Staff s 
            JOIN Account_Info ai ON s.user_id = ai.user_id 
            JOIN Role r ON ai.role_id = r.role_id 
            WHERE s.staff_id = ? AND s.branch_id = ?
        `, [staffId, branchId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Staff member not found in your branch." });
        }

        res.json(rows[0]);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// PUT (update) staff member - only name and contact info
app.put("/api/branch-manager/staff/:id", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const staffId = req.params.id;
        const { name, contact_info } = req.body;

        // Verify the staff belongs to this branch
        const [[staff]] = await pool.query(
            "SELECT staff_id FROM Staff WHERE staff_id = ? AND branch_id = ?",
            [staffId, branchId]
        );

        if (!staff) {
            return res.status(404).json({ message: "Staff member not found in your branch." });
        }

        // Only allow updating name and contact_info
        await pool.query(
            "UPDATE Staff SET name = ?, contact_info = ? WHERE staff_id = ?",
            [name, contact_info, staffId]
        );

        res.status(200).json({ message: "Staff member updated successfully." });
    } catch (err) {
        handleDatabaseError(res, err);
    }
});
// GET the profile information for the logged-in manager
app.get("/api/branch-manager/profile", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const [staffRows] = await pool.query(`SELECT name FROM Staff WHERE user_id = ?`, [req.user.userId]);
        if (staffRows.length === 0) {
            return res.status(404).json({ message: "Manager's staff profile not found." });
        }
        res.json({
            staff_name: staffRows[0].name,
            branch_name: req.branchName,
            branch_id: req.branchId // Pass branch_id to frontend
        });
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// GET statistics for the manager's branch
app.get("/api/branch-manager/stats", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const [[{ staff }]] = await pool.query("SELECT COUNT(*) as staff FROM Staff WHERE branch_id = ?", [branchId]);
        const [dailyCounts] = await pool.query(`
            SELECT 
                SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled_today,
                SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_today,
                SUM(CASE WHEN status = 'Canceled' THEN 1 ELSE 0 END) as canceled_today
            FROM Appointment 
            WHERE branch_id = ? AND DATE(schedule_date) = CURDATE()
        `, [branchId]);

        res.json({
            staff,
            scheduled_today: dailyCounts[0].scheduled_today || 0,
            completed_today: dailyCounts[0].completed_today || 0,
            canceled_today: dailyCounts[0].canceled_today || 0
        });
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// GET all patients that have had an appointment at the manager's branch
app.get("/api/branch-manager/patients", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const [rows] = await pool.query(`
            SELECT DISTINCT
                p.patient_id,
                p.name,
                p.contact_info,
                TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age
            FROM Patient p
            JOIN Appointment a ON p.patient_id = a.patient_id
            WHERE a.branch_id = ?
            ORDER BY p.name ASC
        `, [branchId]);
        res.json(rows);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// GET all appointments for the manager's branch
app.get("/api/branch-manager/appointments", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const [rows] = await pool.query(`
            SELECT a.appointment_id, a.schedule_date, a.status, p.name as patient_name, s.name as doctor_name 
            FROM Appointment a 
            JOIN Patient p ON a.patient_id = p.patient_id 
            JOIN Doctor d ON a.doctor_id = d.doctor_id 
            JOIN Staff s ON d.staff_id = s.staff_id 
            WHERE a.branch_id = ? 
            ORDER BY a.schedule_date DESC
        `, [branchId]);
        res.json(rows);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// GET all staff members for the manager's branch
app.get("/api/branch-manager/staff", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const [rows] = await pool.query(`
            SELECT s.staff_id, s.name, s.contact_info, s.is_medical_staff, r.name as role_name 
            FROM Staff s 
            JOIN Account_Info ai ON s.user_id = ai.user_id 
            JOIN Role r ON ai.role_id = r.role_id 
            WHERE s.branch_id = ? and  r.name != 'Branch Manager'
            ORDER BY s.name ASC
        `, [branchId]);
        res.json(rows);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// GET all invoices for the manager's branch
app.get("/api/branch-manager/invoices", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const [rows] = await pool.query(`
            SELECT i.invoice_id, i.total_amount, i.status, i.due_date, p.name as patient_name 
            FROM Invoice i
            JOIN Appointment a ON i.appointment_id = a.appointment_id
            JOIN Patient p ON a.patient_id = p.patient_id
            WHERE a.branch_id = ?
            ORDER BY i.issued_date DESC
        `, [branchId]);
        res.json(rows);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});
// GET Doctor-wise revenue report
app.get("/api/branch-manager/reports/doctor-revenue", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const [rows] = await pool.query(`
            SELECT 
                s.name as doctor_name, 
                SUM(i.total_amount) as total_revenue
            FROM Invoice i
            JOIN Appointment a ON i.appointment_id = a.appointment_id
            JOIN Doctor d ON a.doctor_id = d.doctor_id
            JOIN Staff s ON d.staff_id = s.staff_id
            WHERE a.branch_id = ? AND i.status = 'Paid'
            GROUP BY s.staff_id, s.name
            ORDER BY total_revenue DESC
        `, [branchId]);
        res.json(rows);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// GET Patients with outstanding balances
app.get("/api/branch-manager/reports/outstanding-balances", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const [rows] = await pool.query(`
            SELECT
                p.name as patient_name,
                i.invoice_id,
                i.due_amount
            FROM Invoice i
            JOIN Appointment a ON i.appointment_id = a.appointment_id
            JOIN Patient p ON a.patient_id = p.patient_id
            WHERE a.branch_id = ? AND i.status IN ('Pending', 'Partially Paid') AND i.due_amount > 0
            ORDER BY p.name
        `, [branchId]);
        res.json(rows);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});
// FIX: This endpoint was taking limited fields. It's now updated to accept the same fields as the global /api/payments endpoint for consistency.
// POST a new payment for an invoice
app.post("/api/branch-manager/invoices/:invoiceId/payments", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    const { invoiceId } = req.params;
    const { paid_amount, payment_date, method_of_payment } = req.body;

    if (!paid_amount || isNaN(paid_amount) || paid_amount <= 0 || !payment_date || !method_of_payment) {
        return res.status(400).json({ message: "Invalid payment data provided." });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if the invoice belongs to the manager's branch
        const [invoiceRows] = await connection.query(`
            SELECT i.total_amount, i.status, i.out_of_pocket_amount, i.due_amount
            FROM Invoice i
            JOIN Appointment a ON i.appointment_id = a.appointment_id
            WHERE i.invoice_id = ? AND a.branch_id = ?
        `, [invoiceId, req.branchId]);

        if (invoiceRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Invoice not found or does not belong to your branch." });
        }
        if (invoiceRows[0].status === 'Paid') {
            await connection.rollback();
            return res.status(400).json({ message: "This invoice is already fully paid." });
        }

        // 2. Record the payment
        await connection.query(
            "INSERT INTO Payment (invoice_id, paid_amount, payment_date, method_of_payment, status) VALUES (?, ?, ?, ?, ?)",
            [invoiceId, paid_amount, payment_date, method_of_payment, 'Completed']
        );

        // 3. Update the invoice's due amount
        await connection.query(
            "UPDATE Invoice SET due_amount = due_amount - ? WHERE invoice_id = ?",
            [paid_amount, invoiceId]
        );

        // 4. Get the updated due_amount to determine the new status
        const [[{ due_amount, out_of_pocket_amount }]] = await connection.query("SELECT due_amount, out_of_pocket_amount FROM Invoice WHERE invoice_id = ?", [invoiceId]);

        // 5. Update invoice status
        let newStatus = 'Pending';
        if (due_amount <= 0) {
            newStatus = 'Paid';
        } else if (due_amount < out_of_pocket_amount) {
            newStatus = 'Partially Paid';
        }

        await connection.query("UPDATE Invoice SET status = ? WHERE invoice_id = ?", [newStatus, invoiceId]);

        await connection.commit();
        res.status(201).json({ message: "Payment recorded successfully", newStatus });

    } catch (err) {
        await connection.rollback();
        handleDatabaseError(res, err);
    } finally {
        connection.release();
    }
});

// FIX: New branch-scoped endpoint for deleting appointments securely.
app.delete("/api/branch-manager/appointments/:id", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const { branchId } = req;

        // Verify the appointment belongs to the manager's branch before deleting
        const [result] = await pool.query(
            `DELETE FROM Appointment WHERE appointment_id = ? AND branch_id = ?`,
            [appointmentId, branchId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Appointment not found in your branch or already deleted." });
        }

        res.status(204).send();
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// Note: For Patients, we are not filtering by branch as the schema doesn't link them directly.
// A manager can manage all patients, similar to a receptionist.
// We also reuse the existing POST/PUT/DELETE endpoints for appointments and patients,
// as the frontend will ensure they can only edit/delete items visible to them.

// =========================================================================================

>>>>>>> Stashed changes
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});