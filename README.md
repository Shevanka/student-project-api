# Student Project Management API

A Node.js and Express REST API for academic project collaboration, private
notes, and project artifact metadata. The repository serves as an educational
cybersecurity research testbed evaluating Broken Object Level Authorization (BOLA),
also known as Insecure Direct Object Reference (IDOR).

> ⚠️ **Security Warning:** This repository is strictly an educational security research lab.
> It contains intentionally weak demonstration credentials (`password123`, `adminpassword123`)
> and hardcoded development secrets. It must **NEVER** be deployed to production or exposed to
> untrusted public networks. See the [vulnerability case study](docs/vulnerability-case-study.md)
> for the comprehensive security audit, threat model, evidence artifacts, and remediation analysis.

## Version History & Status

- **Vulnerable baseline — commit `81646e8`**: the initial commit, where
  `GET /api/notes/:id` returns any note to any authenticated user.
- **Remediation — commit `b67a46d`, merged to `main` in PR #1**: `GET /api/notes/:id`
  enforces object-level authorization
  (`note.user_id === req.user.id || req.user.role === 'admin'`) and the test suite
  asserts that cross-user reads are rejected.

`main` contains the remediated code. To reproduce the original flaw, check out the
baseline in a separate worktree:

```bash
git worktree add ../student-project-api-baseline 81646e8
cd ../student-project-api-baseline
npm install
npm test   # Test 11 confirms Alice can read Bob's Note #42
```

## Features

- JWT-based authentication and role checks.
- Student registration and login with bcrypt password hashing.
- Profile retrieval scoped to the authenticated user.
- CRUD operations for project notes.
- Project metadata and multipart file upload.
- Admin-only user directory.
- SQLite persistence with seeded demo data.
- End-to-end API and authorization regression tests.

## Prerequisites

- Node.js 22.13 or later. The project uses Node's built-in `node:sqlite` module,
  which earlier 22.x releases only expose behind `--experimental-sqlite`.
- npm.

## Installation

```bash
npm install
```

The application creates and seeds its local SQLite database when it starts.
The database file is local development data and should not be used for
production workloads.

## Running the API

Start the server on port 3000:

```bash
npm start
```

Set the `PORT` environment variable to use a different port:

```powershell
$env:PORT = 3001
npm start
```

The API is then available at `http://localhost:3000`.

## Demo Accounts

The local database is seeded with these accounts:

| Username | Password           | Role      | Seed data             |
| -------- | ------------------ | --------- | --------------------- |
| `alice`  | `password123`      | `student` | Alice's project note  |
| `bob`    | `password123`      | `student` | Private Note #42      |
| `admin`  | `adminpassword123` | `admin`   | Administrative access |

These credentials are intentionally weak demonstration values. Never reuse
them outside this local security lab.

## API Overview

All endpoints other than registration and login require a JWT in the
`Authorization` header:

```http
Authorization: Bearer <token>
```

| Method   | Endpoint                 | Access         | Description                                                        |
| -------- | ------------------------ | -------------- | ------------------------------------------------------------------ |
| `POST`   | `/api/auth/register`     | Public         | Register a student account                                         |
| `POST`   | `/api/auth/login`        | Public         | Authenticate and receive a JWT                                     |
| `GET`    | `/api/profile`           | Authenticated  | Retrieve the current user's profile                                |
| `POST`   | `/api/notes`             | Authenticated  | Create a note for the current user                                 |
| `GET`    | `/api/notes`             | Authenticated  | List notes owned by the current user                               |
| `GET`    | `/api/notes/:id`         | Owner or admin | Retrieve an authorized note (remediated; unauthorized returns 403) |
| `PUT`    | `/api/notes/:id`         | Owner or admin | Update an authorized note                                          |
| `DELETE` | `/api/notes/:id`         | Owner or admin | Delete an authorized note                                          |
| `POST`   | `/api/projects/metadata` | Authenticated  | Upload project metadata and an artifact                            |
| `GET`    | `/api/projects/metadata` | Authenticated  | List the current user's project metadata                           |
| `GET`    | `/api/admin/users`       | Admin          | List registered users                                              |

### BOLA Demonstration & Verification

1. **Baseline Vulnerability (commit `81646e8`)**:
   - In the unpatched baseline, Student Alice (`user_id = 1`) could request Note #42 owned by Student Bob (`user_id = 2`) via `GET /api/notes/42` and receive `HTTP 200 OK` with Bob's private capstone notes.
   - Conversely, attempting to modify the same note via `PUT /api/notes/42` returned `HTTP 403 Forbidden`, exposing an asymmetric authorization boundary in the read handler.

2. **Remediated Behavior (current `main`)**:
   - `GET /api/notes/:id` enforces object ownership.
   - When Alice requests Bob's Note #42:
     ```bash
     curl -i http://localhost:3000/api/notes/42 \
       -H "Authorization: Bearer <alice-token>"
     ```
   - The server rejects the unauthorized request with:
     ```http
     HTTP/1.1 403 Forbidden
     Content-Type: application/json

     {"error":"Forbidden: You do not have permission to view this note"}
     ```

For full exploit evidence, CVSS risk scoring, and architectural remediation options, refer to the
[vulnerability case study](docs/vulnerability-case-study.md).

## Running Tests

Run the end-to-end API and authorization test suite:

```bash
npm test
```

The suite covers authentication, profile access, note ownership boundaries,
project metadata, admin role enforcement, and verifies that cross-user private note
retrieval is blocked with `HTTP 403 Forbidden`.

## Project Structure

| Path                                                                   | Purpose                                    |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| [`src/server.js`](src/server.js)                                       | Starts the HTTP server                     |
| [`src/app.js`](src/app.js)                                             | Configures Express and mounts routes       |
| [`src/db.js`](src/db.js)                                               | Initializes SQLite and demo seed data      |
| [`src/middleware/auth.js`](src/middleware/auth.js)                     | JWT authentication and admin authorization |
| [`src/routes/auth.js`](src/routes/auth.js)                             | Registration and login                     |
| [`src/routes/profile.js`](src/routes/profile.js)                       | Authenticated profile endpoint             |
| [`src/routes/notes.js`](src/routes/notes.js)                           | Notes CRUD endpoints (Remediated)          |
| [`src/routes/projects.js`](src/routes/projects.js)                     | Project metadata and uploads               |
| [`src/routes/admin.js`](src/routes/admin.js)                           | Admin user directory                       |
| [`test/test_api.js`](test/test_api.js)                                 | End-to-end regression test suite           |
| [`docs/vulnerability-case-study.md`](docs/vulnerability-case-study.md) | Detailed security audit report             |
| [`docs/agent-vulnerability-walkthrough.md`](docs/agent-vulnerability-walkthrough.md) | Step-by-step brief for an AI agent reproducing and fixing the flaw |

## Security Documentation

The [vulnerability case study](docs/vulnerability-case-study.md) contains:

- BOLA/IDOR classification using OWASP API1:2023, CWE, and CVSS.
- Root-cause analysis and affected source code (with pre-fix historical evidence).
- Reproduction requests, responses, and visual screenshot evidence.
- The `GET 200 OK` versus `PUT 403 Forbidden` asymmetric authorization analysis.
- Threat model, impact assessment, and the applied remediation.
- Additional audit observations and evidence-collection guidance.

## License

This project is distributed under the [MIT License](LICENSE).
