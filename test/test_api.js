const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');

// Spin up a test server on an ephemeral port
let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    server.close(resolve);
  });
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = options.headers || {};
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data };
}

async function runTests() {
  console.log('--- Starting API & Authorization Tests ---');
  await startServer();

  try {
    // 1. Root index endpoint
    console.log('[Test 1] GET / (API Index)');
    const rootRes = await request('/');
    assert.strictEqual(rootRes.status, 200);
    assert.ok(rootRes.data.endpoints);

    // 2. Authentication: Login as Alice, Bob, and Admin
    console.log('[Test 2] POST /api/auth/login');
    const aliceLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'alice', password: 'password123' },
    });
    assert.strictEqual(aliceLogin.status, 200);
    assert.ok(aliceLogin.data.token, 'Alice token received');
    const aliceToken = aliceLogin.data.token;

    const bobLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'bob', password: 'password123' },
    });
    assert.strictEqual(bobLogin.status, 200);
    const bobToken = bobLogin.data.token;

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'adminpassword123' },
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.data.token;

    // 3. Register a new student
    console.log('[Test 3] POST /api/auth/register (New student registration)');
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: `student_${Date.now()}`,
        email: `student_${Date.now()}@university.edu`,
        password: 'password123',
      },
    });
    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regRes.data.user.role, 'student');

    // 4. View own profile
    console.log('[Test 4] GET /api/profile (Authenticated profile retrieval)');
    const profileRes = await request('/api/profile', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(profileRes.data.profile.username, 'alice');
    assert.strictEqual(profileRes.data.profile.id, 1);

    // Unauthenticated profile check
    const unauthProfile = await request('/api/profile');
    assert.strictEqual(unauthProfile.status, 401);

    // 5. Create private project note
    console.log('[Test 5] POST /api/notes (Create private note)');
    const createNoteRes = await request('/api/notes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: {
        title: "Alice's Quantum Computing Notes",
        content: "Drafting circuit designs for assignment 3.",
        is_private: true,
      },
    });
    assert.strictEqual(createNoteRes.status, 201);
    const createdNoteId = createNoteRes.data.note.id;
    assert.strictEqual(createNoteRes.data.note.user_id, 1);

    // 6. List student's own notes
    console.log('[Test 6] GET /api/notes (List own notes)');
    const listNotesRes = await request('/api/notes', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(listNotesRes.status, 200);
    assert.ok(listNotesRes.data.notes.some((n) => n.id === createdNoteId));

    // 7. Update own note
    console.log('[Test 7] PUT /api/notes/:id (Update own note)');
    const updateRes = await request(`/api/notes/${createdNoteId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: {
        title: "Alice's Quantum Computing Notes (Revised)",
        content: "Updated circuit designs with error mitigation.",
      },
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.note.title, "Alice's Quantum Computing Notes (Revised)");

    // 8. Delete own note
    console.log('[Test 8] DELETE /api/notes/:id (Delete own note)');
    const deleteRes = await request(`/api/notes/${createdNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(deleteRes.status, 200);

    // 9. Upload and read project metadata
    console.log('[Test 9] POST /api/projects/metadata and GET /api/projects/metadata');
    const uploadMetaRes = await request('/api/projects/metadata', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: {
        project_name: 'Distributed Ledger Engine',
        description: 'A Byzantine fault-tolerant ledger implemented in Node.js',
      },
    });
    assert.strictEqual(uploadMetaRes.status, 201);
    assert.strictEqual(uploadMetaRes.data.metadata.project_name, 'Distributed Ledger Engine');

    const getMetaRes = await request('/api/projects/metadata', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(getMetaRes.status, 200);
    assert.ok(getMetaRes.data.metadata.length >= 1);

    // 10. Access administrator-only user list
    console.log('[Test 10] GET /api/admin/users (RBAC check)');
    // Student Alice should be denied (403)
    const studentAdminRes = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(studentAdminRes.status, 403, 'Regular student must be denied admin endpoint');

    // Admin should be allowed (200)
    const adminRes = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminRes.status, 200, 'Admin must access admin endpoint');
    assert.ok(Array.isArray(adminRes.data.users));
    assert.ok(adminRes.data.users.length >= 3);

    // 11. DEMONSTRATION OF THE AUTHORIZATION FLAW (BOLA / IDOR): GET /api/notes/42
    console.log('[Test 11] VULNERABILITY VERIFICATION: GET /api/notes/42');

    // Case A: Unauthenticated request must fail with 401
    const unauthNoteRes = await request('/api/notes/42');
    assert.strictEqual(unauthNoteRes.status, 401, 'Unauthenticated access must be rejected');

    // Case B: Alice (User ID 1) requests Note #42 (Owned by Bob, User ID 2)
    const idorRes = await request('/api/notes/42', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });

    assert.strictEqual(idorRes.status, 200, 'Endpoint should return 200 because of missing ownership check');
    assert.strictEqual(idorRes.data.note.id, 42, 'Note ID is 42');
    assert.strictEqual(idorRes.data.note.user_id, 2, "Note belongs to Bob (user_id 2), not Alice (user_id 1)");
    assert.strictEqual(idorRes.data.note.author_username, 'bob');
    assert.strictEqual(idorRes.data.note.is_private, 1, 'Note is private, yet accessible across tenants');
    console.log(' -> VULNERABILITY CONFIRMED: Alice successfully retrieved Bob\'s private Note #42:');
    console.log('    Title:', idorRes.data.note.title);
    console.log('    Author:', idorRes.data.note.author_username);
    console.log('    Content:', idorRes.data.note.content);

    // Case C: Ownership protection IS properly enforced on write operations (PUT/DELETE)
    console.log('[Test 12] PUT /api/notes/42 (Alice attempting to tamper with Bob\'s note)');
    const tamperRes = await request('/api/notes/42', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${aliceToken}` },
      body: { title: 'Tampered Title' },
    });
    assert.strictEqual(tamperRes.status, 403, 'PUT properly rejects unauthorized user');

    const deleteTamperRes = await request('/api/notes/42', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(deleteTamperRes.status, 403, 'DELETE properly rejects unauthorized user');

    console.log('\nAll 12 test assertions passed successfully!');
  } finally {
    await stopServer();
  }
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
