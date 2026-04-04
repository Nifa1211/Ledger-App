const { getDb } = require("../models/db");


function buildFilters({ type, category, date_from, date_to }) {
  const conditions = ["deleted_at IS NULL"];
  const params = [];

  if (type) { conditions.push("type = ?"); params.push(type); }
  if (category) { conditions.push("category LIKE ?"); params.push(`%${category}%`); }
  if (date_from) { conditions.push("date >= ?"); params.push(date_from); }
  if (date_to) { conditions.push("date <= ?"); params.push(date_to); }

  return { where: conditions.join(" AND "), params };
}

function listRecords(filters = {}, { page = 1, limit = 20 } = {}) {
  const db = getDb();
  const { where, params } = buildFilters(filters);
  const offset = (page - 1) * limit;

  const total = db
    .prepare(`SELECT COUNT(*) as c FROM financial_records WHERE ${where}`)
    .get(...params).c;

  const records = db
    .prepare(
      `SELECT r.*, u.name as created_by_name
       FROM financial_records r
       JOIN users u ON u.id = r.created_by
       WHERE ${where}
       ORDER BY r.date DESC, r.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function getRecordById(id) {
  const record = getDb()
    .prepare(
      `SELECT r.*, u.name as created_by_name
       FROM financial_records r
       JOIN users u ON u.id = r.created_by
       WHERE r.id = ? AND r.deleted_at IS NULL`
    )
    .get(id);
  if (!record) throw Object.assign(new Error("Record not found"), { status: 404 });
  return record;
}

function createRecord({ amount, type, category, date, notes }, userId) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO financial_records (amount, type, category, date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(amount, type, category, date, notes ?? null, userId);
  return getRecordById(result.lastInsertRowid);
}

function updateRecord(id, fields) {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM financial_records WHERE id = ? AND deleted_at IS NULL")
    .get(id);
  if (!existing) throw Object.assign(new Error("Record not found"), { status: 404 });

  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  const values = [...Object.values(fields), new Date().toISOString(), id];

  db.prepare(`UPDATE financial_records SET ${sets}, updated_at = ? WHERE id = ?`).run(...values);
  return getRecordById(id);
}

function deleteRecord(id) {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM financial_records WHERE id = ? AND deleted_at IS NULL")
    .get(id);
  if (!existing) throw Object.assign(new Error("Record not found"), { status: 404 });

  db.prepare("UPDATE financial_records SET deleted_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

module.exports = { listRecords, getRecordById, createRecord, updateRecord, deleteRecord };
