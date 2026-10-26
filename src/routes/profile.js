const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/profile
 * Allows authenticated students to view their own profile
 */
router.get('/', authenticateToken, (req, res) => {
  const user = db
    .prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  return res.status(200).json({
    message: 'User profile retrieved successfully',
    profile: user,
  });
});

module.exports = router;
