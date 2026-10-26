const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

/**
 * POST /api/projects/metadata
 * Allows authenticated students to upload project metadata and optional files
 */
router.post('/metadata', authenticateToken, upload.single('file'), (req, res) => {
  const { project_name, description } = req.body;

  if (!project_name) {
    return res.status(400).json({ error: 'project_name is required' });
  }

  const fileName = req.file ? req.file.originalname : null;
  const filePath = req.file ? req.file.path : null;
  const fileSize = req.file ? req.file.size : null;

  try {
    const result = db
      .prepare(`
        INSERT INTO project_metadata (user_id, project_name, description, file_name, file_path, file_size)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(req.user.id, project_name, description || '', fileName, filePath, fileSize);

    const metadataId = Number(result.lastInsertRowid);
    const savedRecord = db
      .prepare('SELECT * FROM project_metadata WHERE id = ?')
      .get(metadataId);

    return res.status(201).json({
      message: 'Project metadata uploaded successfully',
      metadata: savedRecord,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to save project metadata',
      details: error.message,
    });
  }
});

/**
 * GET /api/projects/metadata
 * Lists project metadata uploaded by the current student
 */
router.get('/metadata', authenticateToken, (req, res) => {
  try {
    const items = db
      .prepare('SELECT * FROM project_metadata WHERE user_id = ? ORDER BY uploaded_at DESC')
      .all(req.user.id);

    return res.status(200).json({
      message: 'Project metadata retrieved successfully',
      count: items.length,
      metadata: items,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to retrieve project metadata',
      details: error.message,
    });
  }
});

module.exports = router;
