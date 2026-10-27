# Student Project Management API

A Node.js and Express REST API for academic project collaboration, private
notes, and project artifact metadata. The repository is also an intentionally
vulnerable security research testbed demonstrating Broken Object Level
Authorization (BOLA), also known as Insecure Direct Object Reference (IDOR).

> **Security warning:** This application contains an intentional BOLA
> vulnerability in `GET /api/notes/:id`. Do not deploy it with real data or
> expose it to an untrusted network. See the
> [vulnerability case study](docs/vulnerability-case-study.md) for the full
> analysis, evidence, impact assessment, and remediation guidance.

## Features

- JWT-based authentication and role checks.
- Student registration and login with bcrypt password hashing.
- Profile retrieval scoped to the authenticated user.
- CRUD operations for project notes.
- Project metadata and multipart file upload.
- Admin-only user directory.
- SQLite persistence with seeded demo data.
- End-to-end API and authorization tests.

## Prerequisites

- Node.js 22 or later. The project uses Node's built-in `node:sqlite` module.
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

| Method   | Endpoint                 | Access         | Description                                       |
| -------- | ------------------------ | -------------- | ------------------------------------------------- |
| `POST`   | `/api/auth/register`     | Public         | Register a student account                        |
| `POST`   | `/api/auth/login`        | Public         | Authenticate and receive a JWT                    |
| `GET`    | `/api/profile`           | Authenticated  | Retrieve the current user's profile               |
| `POST`   | `/api/notes`             | Authenticated  | Create a note for the current user                |
| `GET`    | `/api/notes`             | Authenticated  | List notes owned by the current user              |
| `GET`    | `/api/notes/:id`         | Authenticated  | Retrieve a note; intentionally vulnerable to BOLA |
| `PUT`    | `/api/notes/:id`         | Owner or admin | Update an authorized note                         |
| `DELETE` | `/api/notes/:id`         | Owner or admin | Delete an authorized note                         |
| `POST`   | `/api/projects/metadata` | Authenticated  | Upload project metadata and an artifact           |
| `GET`    | `/api/projects/metadata` | Authenticated  | List the current user's project metadata          |
| `GET`    | `/api/admin/users`       | Admin          | List registered users                             |

### Quick BOLA Demonstration

1. Log in as `alice` and copy the returned token.
2. Request Bob's seeded note:

   ```bash
   curl -i http://localhost:3000/api/notes/42 \
     -H "Authorization: Bearer <alice-token>"
   ```

3. The vulnerable endpoint returns Bob's private note with `HTTP 200 OK`.
4. Attempting to modify the same note as Alice returns `HTTP 403 Forbidden`,
   demonstrating the asymmetric read/write authorization controls.

This is only a quick orientation. Do not duplicate the full exploit evidence
or remediation analysis here; refer to the
[vulnerability case study](docs/vulnerability-case-study.md).

## Running Tests

Run the end-to-end API and authorization test suite:

```bash
npm test
```

The suite covers authentication, profile access, note ownership boundaries,
project metadata, admin role enforcement, the intentional BOLA read, and the
corresponding write-protection checks.

## Project Structure

| Path                                                                   | Purpose                                    |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| [`src/server.js`](src/server.js)                                       | Starts the HTTP server                     |
| [`src/app.js`](src/app.js)                                             | Configures Express and mounts routes       |
| [`src/db.js`](src/db.js)                                               | Initializes SQLite and demo seed data      |
| [`src/middleware/auth.js`](src/middleware/auth.js)                     | JWT authentication and admin authorization |
| [`src/routes/auth.js`](src/routes/auth.js)                             | Registration and login                     |
| [`src/routes/profile.js`](src/routes/profile.js)                       | Authenticated profile endpoint             |
| [`src/routes/notes.js`](src/routes/notes.js)                           | Notes CRUD endpoints                       |
| [`src/routes/projects.js`](src/routes/projects.js)                     | Project metadata and uploads               |
| [`src/routes/admin.js`](src/routes/admin.js)                           | Admin user directory                       |
| [`test/test_api.js`](test/test_api.js)                                 | End-to-end test suite                      |
| [`docs/vulnerability-case-study.md`](docs/vulnerability-case-study.md) | Detailed security report                   |

## Security Documentation

The [vulnerability case study](docs/vulnerability-case-study.md) contains:

- BOLA/IDOR classification using OWASP API1:2023, CWE, and CVSS.
- Root-cause analysis and affected source code.
- Reproduction requests and HTTP responses.
- The `GET 200 OK` versus `PUT 403 Forbidden` asymmetric authorization
  evidence.
- Threat model, impact assessment, and remediation options.
- Additional audit observations and evidence-collection guidance.

## License

This project is distributed under the license specified in
[`package.json`](package.json).
