const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/notes
 * Create a new private or public project note for the authenticated student
 */
router.post('/', authenticateToken, (req, res) => {
  const { title, content, is_private } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const isPrivateFlag = is_private !== undefined ? (is_private ? 1 : 0) : 1;

  try {
    const result = db
      .prepare(`
        INSERT INTO notes (user_id, title, content, is_private)
        VALUES (?, ?, ?, ?)
      `)
      .run(req.user.id, title, content, isPrivateFlag);

    const noteId = Number(result.lastInsertRowid);
    const newNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);

    return res.status(201).json({
      message: 'Note created successfully',
      note: newNote,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create note', details: error.message });
  }
});

/**
 * GET /api/notes
 * List all notes owned by the authenticated student
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const notes = db
      .prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);

    return res.status(200).json({
      message: 'Notes retrieved successfully',
      count: notes.length,
      notes,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve notes', details: error.message });
  }
});

/**
 * GET /api/notes/:id
 * ============================================================================
 * VULNERABLE ENDPOINT: Broken Object Level Authorization (BOLA / IDOR)
 * ============================================================================
 * Flaw Explanation:
 * 1. The endpoint correctly requires the caller to be logged in (via `authenticateToken`).
 * 2. However, it looks up the note purely by the URL parameter `req.params.id`.
 * 3. It DOES NOT verify that `note.user_id === req.user.id`.
 * 4. Consequently, any authenticated student (e.g. Alice) can request
 *    GET /api/notes/42 and view another student's (e.g. Bob's) private note.
 *
 * Secure Remediation:
 * Validate that the requester owns the note before returning it:
 * if (note.user_id !== req.user.id && req.user.role !== 'admin') {
 *   return res.status(403).json({ error: 'Access denied: You do not own this note' });
 * }
 * ============================================================================
 */
router.get('/:id', authenticateToken, (req, res) => {
  const noteId = parseInt(req.params.id, 10);

  if (isNaN(noteId)) {
    return res.status(400).json({ error: 'Invalid note ID' });
  }

  try {
    // Retrieve note by ID
    const note = db
      .prepare(`
        SELECT notes.*, users.username AS author_username
        FROM notes
        JOIN users ON notes.user_id = users.id
        WHERE notes.id = ?
      `)
      .get(noteId);

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Object-level authorization check: Only the owner (or admin) can view the note
    if (note.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to view this note',
      });
    }

    return res.status(200).json({
      message: 'Note retrieved successfully',
      note,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve note', details: error.message });
  }
});

/**
 * PUT /api/notes/:id
 * Update an existing note (Properly validates ownership)
 */
router.put('/:id', authenticateToken, (req, res) => {
  const noteId = parseInt(req.params.id, 10);
  const { title, content, is_private } = req.body;

  if (isNaN(noteId)) {
    return res.status(400).json({ error: 'Invalid note ID' });
  }

  try {
    const existingNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Secure authorization check: Only the owner (or admin) can update
    if (existingNote.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to update this note',
      });
    }

    const updatedTitle = title !== undefined ? title : existingNote.title;
    const updatedContent = content !== undefined ? content : existingNote.content;
    const updatedIsPrivate =
      is_private !== undefined ? (is_private ? 1 : 0) : existingNote.is_private;

    db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, is_private = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedTitle, updatedContent, updatedIsPrivate, noteId);

    const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);

    return res.status(200).json({
      message: 'Note updated successfully',
      note: updatedNote,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update note', details: error.message });
  }
});

/**
 * DELETE /api/notes/:id
 * Delete a note (Properly validates ownership)
 */
router.delete('/:id', authenticateToken, (req, res) => {
  const noteId = parseInt(req.params.id, 10);

  if (isNaN(noteId)) {
    return res.status(400).json({ error: 'Invalid note ID' });
  }

  try {
    const existingNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Secure authorization check: Only the owner (or admin) can delete
    if (existingNote.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to delete this note',
      });
    }

    db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);

    return res.status(200).json({
      message: `Note ${noteId} deleted successfully`,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete note', details: error.message });
  }
});

module.exports = router;
