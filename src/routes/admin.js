const express = require('express');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/admin/users
 * Administrator-only endpoint to list all registered users.
 * Regular students attempting to access this endpoint will receive HTTP 403 Forbidden.
 */
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = db
      .prepare('SELECT id, username, email, role, created_at FROM users ORDER BY id ASC')
      .all();

    return res.status(200).json({
      message: 'User list retrieved successfully (Administrator Access)',
      count: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve user list',
      details: error.message,
    });
  }
});

module.exports = router;
