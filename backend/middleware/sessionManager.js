// ============================================================================
// SESSION MANAGER MIDDLEWARE
// Phase 1: Security Foundation - Session Management with Timeout
// ============================================================================
// Implements 30-minute inactivity timeout as per Section 5.3

const crypto = require('crypto');

// Session timeout: 30 minutes (in milliseconds)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_MAX_LIFETIME = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Middleware to check session validity and enforce timeout
 * Section 5.3: Session timeout after 30 minutes of inactivity
 */
const sessionManager = (pool) => {
  return async (req, res, next) => {
    // Only check for authenticated requests
    if (!req.user || !req.headers.authorization) {
      return next();
    }

    const token = req.headers.authorization.split(' ')[1];

    try {
      // Check if session exists and is not expired
      const [sessions] = await pool.query(
        `SELECT * FROM user_sessions
         WHERE user_id = ? AND token = ? AND expires_at > NOW()
         ORDER BY last_activity DESC LIMIT 1`,
        [req.user.userId, token]
      );

      if (sessions.length === 0) {
        return res.status(401).json({
          message: 'Session expired. Please login again.',
          code: 'SESSION_EXPIRED'
        });
      }

      const session = sessions[0];
      const now = new Date();
      const lastActivity = new Date(session.last_activity);
      const timeSinceActivity = now.getTime() - lastActivity.getTime();

      // Check 30-minute inactivity timeout
      if (timeSinceActivity > SESSION_TIMEOUT) {
        // Delete expired session
        await pool.query('DELETE FROM user_sessions WHERE session_id = ?', [session.session_id]);

        return res.status(401).json({
          message: 'Session expired due to inactivity (30 minutes).',
          code: 'SESSION_TIMEOUT'
        });
      }

      // Update last_activity timestamp (activity tracking)
      await pool.query(
        'UPDATE user_sessions SET last_activity = NOW() WHERE session_id = ?',
        [session.session_id]
      );

      // Attach session info to request for other middleware
      req.session = {
        session_id: session.session_id,
        created_at: session.created_at,
        last_activity: now
      };

      next();
    } catch (err) {
      console.error('Session management error:', err);
      // On error, continue but log the issue
      next();
    }
  };
};

/**
 * Create a new session on login
 * Returns session_id for tracking
 */
async function createSession(pool, userId, token, ipAddress, userAgent) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_LIFETIME);

  try {
    await pool.query(
      `INSERT INTO user_sessions (session_id, user_id, token, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, token, expiresAt, ipAddress, userAgent]
    );

    return sessionId;
  } catch (err) {
    console.error('Failed to create session:', err);
    throw err;
  }
}

/**
 * Destroy session on logout
 */
async function destroySession(pool, userId, token) {
  try {
    const [result] = await pool.query(
      'DELETE FROM user_sessions WHERE user_id = ? AND token = ?',
      [userId, token]
    );

    return result.affectedRows > 0;
  } catch (err) {
    console.error('Failed to destroy session:', err);
    throw err;
  }
}

/**
 * Destroy all sessions for a user (useful for security breaches)
 */
async function destroyAllUserSessions(pool, userId) {
  try {
    const [result] = await pool.query(
      'DELETE FROM user_sessions WHERE user_id = ?',
      [userId]
    );

    return result.affectedRows;
  } catch (err) {
    console.error('Failed to destroy all user sessions:', err);
    throw err;
  }
}

/**
 * Clean up expired sessions (run periodically)
 */
async function cleanupExpiredSessions(pool) {
  try {
    const [result] = await pool.query(
      'DELETE FROM user_sessions WHERE expires_at < NOW() OR last_activity < DATE_SUB(NOW(), INTERVAL 30 MINUTE)'
    );

    console.log(`Cleaned up ${result.affectedRows} expired sessions`);
    return result.affectedRows;
  } catch (err) {
    console.error('Failed to cleanup expired sessions:', err);
    throw err;
  }
}

/**
 * Get active sessions for a user
 */
async function getUserActiveSessions(pool, userId) {
  try {
    const [sessions] = await pool.query(
      `SELECT session_id, created_at, last_activity, ip_address, user_agent
       FROM user_sessions
       WHERE user_id = ? AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId]
    );

    return sessions;
  } catch (err) {
    console.error('Failed to get user sessions:', err);
    throw err;
  }
}

module.exports = {
  sessionManager,
  createSession,
  destroySession,
  destroyAllUserSessions,
  cleanupExpiredSessions,
  getUserActiveSessions,
  SESSION_TIMEOUT,
  SESSION_MAX_LIFETIME
};
