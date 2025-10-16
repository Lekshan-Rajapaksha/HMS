// server.js
require("dotenv").config();


const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// --- DATABASE CONFIGURATION ---
const dbConfig = {
    host: "localhost",
    user: "root",
    password: "Lekshan123@", // Replace with your MySQL password
    database: "hospital_managment", // Replace with your database name
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
    res.status(500).json({ error: "An internal server error occurred." });
};

// --- GENERIC CRUD Endpoints ---
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
        const [rows] = await pool.query(`SELECT a.*, p.name as patient_name, s.name as doctor_name, b.name as branch_name FROM Appointment a JOIN Patient p ON a.patient_id = p.patient_id JOIN Doctor d ON a.doctor_id = d.doctor_id JOIN Staff s ON d.staff_id = s.staff_id JOIN Branch b ON a.branch_id = b.branch_id ORDER BY a.schedule_date DESC`);
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

        const appointmentId = req.params.id;
        const requestBody = req.body;
        const { userId } = req.user;

        // Check if this is a reschedule or a general update
        if (requestBody.status === 'Rescheduled' && requestBody.schedule_date) {
            const newDate = new Date(requestBody.schedule_date).toISOString().slice(0, 19).replace('T', ' ');
            
            const [[staffMember]] = await connection.query('SELECT staff_id FROM Staff WHERE user_id = ?', [userId]);
            const [[currentAppointment]] = await connection.query('SELECT schedule_date FROM Appointment WHERE appointment_id = ?', [appointmentId]);

            if (!staffMember || !currentAppointment) {
                throw new Error("Could not find staff or appointment details.");
            }

            const [logResult] = await connection.query(
                'INSERT INTO rescheduled_appointments (previous_appointment_id, previous_date, new_date, rescheduled_by_staff_id, reschedule_reason) VALUES (?, ?, ?, ?, ?)',
                [appointmentId, currentAppointment.schedule_date, newDate, staffMember.staff_id, requestBody.reschedule_reason || null]
            );
            
            await connection.query(
                "UPDATE Appointment SET schedule_date = ?, reschedule_id = ?, status = 'Rescheduled' WHERE appointment_id = ?",
                [newDate, logResult.insertId, appointmentId]
            );

            await connection.commit();
            res.status(200).json({ message: `Appointment rescheduled successfully` });

        } else {
            // Handle a general update (e.g., just changing status, or other details)
            const updates = Object.keys(requestBody).map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(requestBody), appointmentId];
            await connection.query(`UPDATE Appointment SET ${updates} WHERE appointment_id = ?`, values);
            
            await connection.commit();
            res.status(200).json({ message: 'Appointment updated successfully' });
        }
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

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});