# Student Portal REST API (BOLA / IDOR Demonstration)

A small, self-contained REST API built in Node.js and Express demonstrating student authentication, role-based access control, resource management, and a classic **Broken Object Level Authorization (BOLA)** / **Insecure Direct Object Reference (IDOR)** vulnerability.

---

## 1. Overview & Architecture

The API allows students to register, authenticate, view their profiles, manage private project notes, upload project metadata, and allows administrators to inspect user lists.

### Pre-seeded Demo Accounts

When the server starts, it initializes a local SQLite database (`data.sqlite`) pre-populated with:

| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `alice` | `password123` | `student` | Student User (ID: 1). |
| `bob` | `password123` | `student` | Student User (ID: 2). Owns private note **#42**. |
| `admin` | `adminpassword123` | `admin` | Administrator User (ID: 3). |

---

## 2. API Endpoints Reference

### Authentication
- **`POST /api/auth/register`**
  - **Body**: `{ "username": "...", "email": "...", "password": "..." }`
  - Creates a new student account (default role: `student`) and returns a JWT token.
- **`POST /api/auth/login`**
  - **Body**: `{ "username": "...", "password": "..." }`
  - Validates credentials and returns a JWT token.

### Profile
- **`GET /api/profile`**
  - **Header**: `Authorization: Bearer <token>`
  - Retrieves the profile of the currently logged-in student.

### Project Notes
- **`POST /api/notes`**
  - **Header**: `Authorization: Bearer <token>`
  - **Body**: `{ "title": "...", "content": "...", "is_private": true }`
  - Creates a new note linked to the authenticated user.
- **`GET /api/notes`**
  - **Header**: `Authorization: Bearer <token>`
  - Lists all notes owned by the authenticated student.
- **`GET /api/notes/:id`**  ⚠️ **VULNERABLE ENDPOINT (BOLA / IDOR)**
  - **Header**: `Authorization: Bearer <token>`
  - Verifies that the requester is authenticated, but **fails to check note ownership**.
  - Any logged-in student can retrieve another student's private note by supplying its ID (e.g. `GET /api/notes/42`).
- **`PUT /api/notes/:id`** (Secure)
  - **Header**: `Authorization: Bearer <token>`
  - Updates a note. Enforces that `note.user_id === req.user.id`.
- **`DELETE /api/notes/:id`** (Secure)
  - **Header**: `Authorization: Bearer <token>`
  - Deletes a note. Enforces that `note.user_id === req.user.id`.

### Project Metadata
- **`POST /api/projects/metadata`**
  - **Header**: `Authorization: Bearer <token>`
  - **Body / Multipart**: Supports JSON or multipart/form-data upload (`project_name`, `description`, optional `file`).
- **`GET /api/projects/metadata`**
  - **Header**: `Authorization: Bearer <token>`
  - Retrieves metadata uploaded by the current student.

### Administrator Operations
- **`GET /api/admin/users`**
  - **Header**: `Authorization: Bearer <admin_token>`
  - Returns a list of all registered users. Regular students receive `403 Forbidden`.

---

## 3. The Vulnerability: Detailed Analysis

### Location
File: [`src/routes/notes.js`](src/routes/notes.js)

### The Vulnerable Code Pattern
```javascript
// GET /api/notes/:id
router.get('/:id', authenticateToken, (req, res) => {
  const noteId = parseInt(req.params.id, 10);
  
  // 1. Authenticated check passes (req.user exists)
  // 2. Note is fetched directly by ID from the URL
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  // FLAW: Missing check: if (note.user_id !== req.user.id) { ... }
  // The note is returned to ANY authenticated requester!
  return res.status(200).json({ note });
});
```

### Why It Happens
The application confuses **Authentication** (verifying *who* the caller is) with **Authorization** (verifying *whether* the caller has rights to the specific resource). The endpoint verifies that a valid JWT token was presented, but blindly relies on the user-controlled object ID in the route path without validating resource ownership.

### Contrast with Secure Implementation
In the same file, the `PUT /api/notes/:id` and `DELETE /api/notes/:id` handlers implement proper object-level authorization:

```javascript
// Secure Authorization Check
if (existingNote.user_id !== req.user.id && req.user.role !== 'admin') {
  return res.status(403).json({
    error: 'Forbidden: You do not have permission to access or modify this note',
  });
}
```

### Remediation (How to Fix It)
To fix `GET /api/notes/:id`, either:

1. **Explicit Ownership Condition in the Query:**
   ```javascript
   const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(noteId, req.user.id);
   if (!note) return res.status(404).json({ error: 'Note not found' });
   ```
2. **Post-Query Ownership Verification:**
   ```javascript
   if (note.user_id !== req.user.id && req.user.role !== 'admin') {
     return res.status(403).json({ error: 'Access denied: You do not own this note' });
   }
   ```

---

## 4. Running the Project

### Prerequisites
- Node.js (v18+)

### Install Dependencies
```bash
npm install
```

### Start the Server
```bash
npm start
```
The server will start on `http://localhost:3000`.

### Run Automated Tests
```bash
npm test
```
The automated test suite runs through all 12 operational and security test cases, verifying both the valid behaviors and confirming the authorization flaw on `GET /api/notes/42`.

---

## 5. Walkthrough & Reproduction via cURL

### Step 1: Log in as Alice (Student)
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "password123"}'
```
*Save the returned `token` into an environment variable:*
```bash
ALICE_TOKEN="<token_from_response>"
```

### Step 2: View Alice's Profile
```bash
curl -s -X GET http://localhost:3000/api/profile \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

### Step 3: Exploit the Flaw to Access Bob's Private Note (#42)
Bob owns Note #42. As Alice, request:
```bash
curl -s -X GET http://localhost:3000/api/notes/42 \
  -H "Authorization: Bearer $ALICE_TOKEN"
```
**Result**: The server returns HTTP `200 OK` with Bob's private capstone notes:
```json
{
  "message": "Note retrieved successfully",
  "note": {
    "id": 42,
    "user_id": 2,
    "title": "Bob's Confidential Project Architecture",
    "content": "Private Note #42: Confidential capstone design specifications...",
    "is_private": 1,
    "author_username": "bob"
  },
  "security_notice": "WARNING: Authorization flaw exposed! You retrieved another user's note."
}
```

### Step 4: Verify Admin Restriction
Attempting to view the user list as Alice:
```bash
curl -s -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $ALICE_TOKEN"
```
**Result**: HTTP `403 Forbidden` (`Administrator privileges are required`).
