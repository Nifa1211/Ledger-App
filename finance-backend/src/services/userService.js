const { getDb } = require("../models/db");

const PUBLIC_FIELDS = "id, name, email, role, status, created_at";

function listUsers({ page = 1, limit = 20 } = {}) {
  const db = getDb();
  const offset = (page - 1) * limit;
  const total = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const users = db
    .prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY id LIMIT ? OFFSET ?`)
    .all(limit, offset);
  return { users, total, page, limit };
}

function getUserById(id) {
  const user = getDb()
    .prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`)
    .get(id);
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  return user;
}

function updateUser(id, fields) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!existing) throw Object.assign(new Error("User not found"), { status: 404 });

  const sets = Object.keys(fields)
    .map((k) => `${k} = ?`)
    .join(", ");
  const values = [...Object.values(fields), new Date().toISOString(), id];

  db.prepare(`UPDATE users SET ${sets}, updated_at = ? WHERE id = ?`).run(...values);
  return getUserById(id);
}

function deleteUser(id, requestingUserId) {
  if (id === requestingUserId) {
    throw Object.assign(new Error("Cannot delete your own account"), { status: 400 });
  }
  const db = getDb();
  const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
  if (result.changes === 0) throw Object.assign(new Error("User not found"), { status: 404 });
}

module.exports = { listUsers, getUserById, updateUser, deleteUser };
