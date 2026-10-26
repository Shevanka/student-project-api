const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Student registration endpoint
 */
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  // Check if username or email already exists
  const existingUser = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);

  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already in use' });
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const role = 'student'; // Default role is student

    const result = db
      .prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)')
      .run(username, email, passwordHash, role);

    const newUser = {
      id: Number(result.lastInsertRowid),
      username,
      email,
      role,
    };

    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: newUser,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to register user', details: error.message });
  }
});

/**
 * POST /api/auth/login
 * User login endpoint
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const passwordValid = bcrypt.compareSync(password, user.password);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  const token = generateToken(safeUser);

  return res.status(200).json({
    message: 'Login successful',
    token,
    user: safeUser,
  });
});

module.exports = router;
