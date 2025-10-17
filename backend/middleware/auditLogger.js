// ============================================================================
// AUDIT LOGGER MIDDLEWARE
// Phase 1: Security Foundation - Comprehensive Audit Logging
// ============================================================================
// This middleware logs all doctor actions to audit_log table and
// tracks patient data access for PDPA compliance

const mysql = require('mysql2/promise');

/**
 * Middleware to log all doctor actions to audit_log table
 * Captures: user_id, action, table_name, record_id, old/new values, IP, timestamp
 *
 * Section 2.2: All actions must be logged with user, timestamp, reason
 * Section 5.7: Audit logs retained for 15 years
 */
const auditLogger = (pool) => {
  return async (req, res, next) => {
    // Only log for authenticated users
    if (!req.user) {
      return next();
    }

    // Store original body for old_value comparison
    if (req.method !== 'GET') {
      req.originalBody = JSON.parse(JSON.stringify(req.body || {}));
    }

    // Intercept response to log after action completes
    const originalSend = res.send;
    res.send = function (data) {
      const statusCode = res.statusCode;

      // Only log successful non-GET requests (mutations)
      if (statusCode >= 200 && statusCode < 300 && req.method !== 'GET') {
        const logEntry = {
          user_id: req.user.userId,
          action: `${req.method} ${req.path}`,
          table_name: extractTableFromPath(req.path),
          record_id: extractRecordId(req),
          old_value: req.originalBody ? JSON.stringify(req.originalBody) : null,
          new_value: req.body ? JSON.stringify(req.body) : null,
          ip_address: req.ip || req.connection.remoteAddress
        };

        // Async insert (non-blocking)
        insertAuditLog(pool, logEntry).catch(err => {
          console.error('Audit log error:', err.message);
        });
      }

      // Log data access for GET requests to sensitive patient data
      if (req.method === 'GET' && statusCode >= 200 && statusCode < 300) {
        const isSensitiveData = req.path.includes('/patients/') || req.path.includes('/patient');

        if (isSensitiveData) {
          const accessLog = {
            user_id: req.user.userId,
            patient_id: req.params.patientId || req.params.id || null,
            action: 'VIEW',
            endpoint: req.path,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.headers['user-agent']
          };

          insertDataAccessLog(pool, accessLog).catch(err => {
            console.error('Data access log error:', err.message);
          });
        }
      }

      originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Insert audit log entry into database
 */
async function insertAuditLog(pool, logEntry) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        logEntry.user_id,
        logEntry.action,
        logEntry.table_name,
        logEntry.record_id,
        logEntry.old_value,
        logEntry.new_value,
        logEntry.ip_address
      ]
    );
  } catch (err) {
    console.error('Failed to insert audit log:', err.message);
    // Don't throw - we don't want to break the request if logging fails
  }
}

/**
 * Insert data access log entry for PDPA compliance
 * Sri Lanka PDPA No. 9 of 2022 compliance
 */
async function insertDataAccessLog(pool, accessLog) {
  try {
    await pool.query(
      `INSERT INTO data_access_log (user_id, patient_id, action, endpoint, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        accessLog.user_id,
        accessLog.patient_id,
        accessLog.action,
        accessLog.endpoint,
        accessLog.ip_address,
        accessLog.user_agent
      ]
    );
  } catch (err) {
    console.error('Failed to insert data access log:', err.message);
  }
}

/**
 * Extract table name from API path
 */
function extractTableFromPath(path) {
  if (path.includes('/appointments')) return 'appointment';
  if (path.includes('/patients')) return 'patient';
  if (path.includes('/treatments')) return 'appointment_treatment';
  if (path.includes('/notes')) return 'appointment';
  if (path.includes('/medical-history')) return 'patient';
  return 'unknown';
}

/**
 * Extract record ID from request parameters
 */
function extractRecordId(req) {
  return req.params.id ||
         req.params.appointmentId ||
         req.params.patientId ||
         req.params.serviceCode ||
         (req.body && req.body.appointment_id) ||
         null;
}

module.exports = auditLogger;
