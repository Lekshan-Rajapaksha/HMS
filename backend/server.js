// server.js

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- SECRET KEY (IMPORTANT!) ---
// In a real app, store this in an environment variable (e.g., process.env.JWT_SECRET)
const JWT_SECRET = 'your-super-secret-and-long-key-for-security';

// --- DATABASE CONFIGURATION ---
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- UTILITY FUNCTION for error handling ---
const handleDatabaseError = (res, err) => {
    console.error("Database Error:", err);
    res.status(500).json({ message: "An internal server error occurred." });
};

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
            if (allowedRoles.includes(req.user.role)) {
                next(); // User has the required role, proceed
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

        res.json({ message: "Login successful", token, role: user.role.toLowerCase() });

    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// --- GENERIC CRUD Endpoints (Protected for Admins) ---
const createCrudEndpoints = (entityName, tableName, idColumn) => {
    const endpoint = `/api/${entityName}`;

    app.get(endpoint, authorize(['admin']), async (req, res) => {
        try {
            const [rows] = await pool.query(`SELECT * FROM ${tableName}`);
            res.json(rows);
        } catch (err) {
            handleDatabaseError(res, err);
        }
    });

    app.get(`${endpoint}/:id`, authorize(['admin']), async (req, res) => {
        try {
            const [rows] = await pool.query(`SELECT * FROM ${tableName} WHERE ${idColumn} = ?`, [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ message: `${entityName} not found` });
            res.json(rows[0]);
        } catch (err) {
            handleDatabaseError(res, err);
        }
    });

    app.post(endpoint, authorize(['admin']), async (req, res) => {
        try {
            const columns = Object.keys(req.body).join(', ');
            const placeholders = Object.keys(req.body).map(() => '?').join(', ');
            const values = Object.values(req.body);
            await pool.query(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`, values);
            res.status(201).json({ message: `${entityName} created successfully` });
        } catch (err) {
            handleDatabaseError(res, err);
        }
    });

    app.put(`${endpoint}/:id`, authorize(['admin']), async (req, res) => {
        try {
            const updates = Object.keys(req.body).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(req.body), req.params.id];
            await pool.query(`UPDATE ${tableName} SET ${updates} WHERE ${idColumn} = ?`, values);
            res.status(200).json({ message: `${entityName} updated successfully` });
        } catch (err) {
            handleDatabaseError(res, err);
        }
    });

    app.delete(`${endpoint}/:id`, authorize(['admin']), async (req, res) => {
        try {
            await pool.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [req.params.id]);
            res.status(204).send();
        } catch (err) {
            handleDatabaseError(res, err);
        }
    });
};

// --- API ROUTES ---

// Lists can be accessed by admin, receptionist, and doctor for forms
app.get("/api/list/:type", authorize(['admin', 'receptionist', 'doctor']), async (req, res) => {
    const { type } = req.params;
    let query;
    try {
        switch (type) {
            case "patients": query = "SELECT patient_id, name FROM Patient ORDER BY patient_id"; break;
            case "doctors": query = "SELECT d.doctor_id, s.name, sp.name as specialty FROM Doctor d JOIN Staff s ON d.staff_id = s.staff_id LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id LEFT JOIN Specialties sp ON ds.specialty_id = sp.specialty_id ORDER BY s.name"; break;
            case "branches": query = "SELECT branch_id, name FROM Branch ORDER BY name"; break;
            case "roles": query = "SELECT role_id, name FROM Role ORDER BY name"; break;
            case "insurance-providers": query = "SELECT id, name FROM Insurance_Provider ORDER BY name"; break;
            case "specialties": query = "SELECT specialty_id, name FROM Specialties ORDER BY name"; break;
            default: return res.status(404).json({ message: "List type not found" });
        }
        const [results] = await pool.query(query);
        res.json(results);
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// Admin Dashboard stats
app.get("/api/stats/treatment-distribution", authorize(['admin']), async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT tc.name, COUNT(at.service_code) as count FROM Appointment_Treatment at JOIN Treatment_Catalogue tc ON at.service_code = tc.service_code GROUP BY tc.name ORDER BY count DESC LIMIT 5;`);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});
app.get("/api/stats/daily-patients", authorize(['admin']), async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT DATE(schedule_date) as date, COUNT(DISTINCT patient_id) as count FROM Appointment WHERE schedule_date >= CURDATE() - INTERVAL 7 DAY GROUP BY DATE(schedule_date) ORDER BY date ASC;`);
        res.json(rows);
    } catch (err) { handleDatabaseError(res, err); }
});
app.get("/api/stats/summary", authorize(['admin']), async (req, res) => {
    try {
        const [[{ patients }]] = await pool.query("SELECT COUNT(*) as patients FROM Patient");
        const [[{ appointments }]] = await pool.query("SELECT COUNT(*) as appointments FROM Appointment WHERE status = 'Scheduled'");
        const [[{ doctors }]] = await pool.query("SELECT COUNT(*) as doctors FROM Doctor");
        res.json({ patients, appointments, doctors });
    } catch (err) { handleDatabaseError(res, err); }
});

// Patients (GET for admin/receptionist, POST/PUT for admin/receptionist, DELETE for admin)
app.get("/api/patients", authorize(['admin', 'receptionist']), async (req, res) => {
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
        // MODIFIED QUERY: Added p.insurance_provider_id to the selection
        const [rows] = await pool.query(`
            SELECT s.*, r.name as role_name, b.name as branch_name
            FROM Staff s
            JOIN Account_Info ai ON s.user_id = ai.user_id
            JOIN Role r ON ai.role_id = r.role_id
            JOIN Branch b ON s.branch_id = b.branch_id
            ORDER BY s.name`);
        res.json(rows);

    } catch (err) {
        handleDatabaseError(res, err);
    }
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
            `SELECT branch_id, name as branch_name FROM Branch WHERE manager_user_id = ?`, 
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

// GET the profile information for the logged-in manager
app.get("/api/branch-manager/profile", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const [staffRows] = await pool.query(`SELECT name FROM Staff WHERE user_id = ?`, [req.user.userId]);
        if (staffRows.length === 0) {
            return res.status(404).json({ message: "Manager's staff profile not found." });
        }
        res.json({
            staff_name: staffRows[0].name,
            branch_name: req.branchName // Fetched from middleware
        });
    } catch (err) {
        handleDatabaseError(res, err);
    }
});

// GET statistics for the manager's branch
app.get("/api/branch-manager/stats", authorize(['branch manager']), getBranchInfoFromToken, async (req, res) => {
    try {
        const { branchId } = req;
        const [[{ appointments }]] = await pool.query("SELECT COUNT(*) as appointments FROM Appointment WHERE branch_id = ? AND status = 'Scheduled'", [branchId]);
        const [[{ staff }]] = await pool.query("SELECT COUNT(*) as staff FROM Staff WHERE branch_id = ?", [branchId]);
        const [[{ daily_appointments }]] = await pool.query("SELECT COUNT(*) as daily_appointments FROM Appointment WHERE branch_id = ? AND DATE(schedule_date) = CURDATE()", [branchId]);
        
        res.json({ appointments, staff, daily_appointments });
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
            WHERE s.branch_id = ? 
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
        const { appointmentId } = req.params;
        const [rows] = await pool.query(`
            SELECT tc.service_code, tc.name, tc.price 
            FROM Appointment_Treatment at
            JOIN Treatment_Catalogue tc ON at.service_code = tc.service_code
            WHERE at.appointment_id = ?
        `, [appointmentId]);
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

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});