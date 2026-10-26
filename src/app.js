const express = require('express');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const notesRoutes = require('./routes/notes');
const projectsRoutes = require('./routes/projects');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome & endpoint index
app.get('/', (req, res) => {
  res.json({
    name: 'Student Portal REST API',
    version: '1.0.0',
    description: 'Educational REST API demonstrating authentication, role-based access control, and an authorization vulnerability (BOLA / IDOR).',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
      },
      profile: {
        view: 'GET /api/profile',
      },
      notes: {
        create: 'POST /api/notes',
        list: 'GET /api/notes',
        get_by_id: 'GET /api/notes/:id (VULNERABLE to BOLA/IDOR)',
        update: 'PUT /api/notes/:id',
        delete: 'DELETE /api/notes/:id',
      },
      projects: {
        upload_metadata: 'POST /api/projects/metadata',
        list_metadata: 'GET /api/projects/metadata',
      },
      admin: {
        list_users: 'GET /api/admin/users (Requires admin role)',
      },
    },
    demo_credentials: [
      { username: 'alice', password: 'password123', role: 'student' },
      { username: 'bob', password: 'password123', role: 'student (owns private note #42)' },
      { username: 'admin', password: 'adminpassword123', role: 'admin' },
    ],
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

module.exports = app;
