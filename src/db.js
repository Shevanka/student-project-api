const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_private INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS project_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT,
    file_name TEXT,
    file_path TEXT,
    file_size INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Seed default users and sample notes if not already present
function seedDatabase() {
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (countUsers === 0) {
    const passwordHash = bcrypt.hashSync('password123', 10);
    const adminPasswordHash = bcrypt.hashSync('adminpassword123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Student 1: Alice (ID: 1)
    insertUser.run(1, 'alice', 'alice@university.edu', passwordHash, 'student');

    // Student 2: Bob (ID: 2)
    insertUser.run(2, 'bob', 'bob@university.edu', passwordHash, 'student');

    // Admin: Admin User (ID: 3)
    insertUser.run(3, 'admin', 'admin@university.edu', adminPasswordHash, 'admin');

    const insertNote = db.prepare(`
      INSERT INTO notes (id, user_id, title, content, is_private)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Alice's personal note (ID: 1)
    insertNote.run(
      1,
      1,
      "Alice's Project Proposal",
      "Draft proposal for distributed systems coursework. Topics include consensus protocols and fault tolerance.",
      1
    );

    // Bob's private confidential note (ID: 42)
    insertNote.run(
      42,
      2,
      "Bob's Confidential Project Architecture",
      "Private Note #42: Confidential capstone design specifications, API keys, and grading criteria. Not for peer distribution.",
      1
    );

    console.log('Database seeded successfully with initial users and Note #42.');
  }
}

seedDatabase();

module.exports = db;
