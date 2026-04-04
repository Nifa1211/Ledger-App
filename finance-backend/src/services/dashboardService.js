const { getDb } = require("../models/db");



function getSummary() {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
         COUNT(*) AS total_records
       FROM financial_records
       WHERE deleted_at IS NULL`
    )
    .get();

  return {
    total_income: row.total_income,
    total_expenses: row.total_expenses,
    net_balance: row.total_income - row.total_expenses,
    total_records: row.total_records,
  };
}

function getCategoryTotals() {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         category,
         type,
         ROUND(SUM(amount), 2) AS total,
         COUNT(*)              AS count
       FROM financial_records
       WHERE deleted_at IS NULL
       GROUP BY category, type
       ORDER BY total DESC`
    )
    .all();
}

function getMonthlyTrends({ months = 12 } = {}) {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         strftime('%Y-%m', date)                                              AS month,
         ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 2)      AS income,
         ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2)      AS expenses,
         ROUND(SUM(CASE WHEN type='income'  THEN amount
                        WHEN type='expense' THEN -amount ELSE 0 END), 2)     AS net
       FROM financial_records
       WHERE deleted_at IS NULL
         AND date >= date('now', ? || ' months')
       GROUP BY month
       ORDER BY month ASC`
    )
    .all(`-${months}`);
}

function getWeeklyTrends({ weeks = 8 } = {}) {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         strftime('%Y-W%W', date)                                             AS week,
         ROUND(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 2)      AS income,
         ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 2)      AS expenses
       FROM financial_records
       WHERE deleted_at IS NULL
         AND date >= date('now', ? || ' days')
       GROUP BY week
       ORDER BY week ASC`
    )
    .all(`-${weeks * 7}`);
}

function getRecentActivity({ limit = 10 } = {}) {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes, u.name AS created_by_name
       FROM financial_records r
       JOIN users u ON u.id = r.created_by
       WHERE r.deleted_at IS NULL
       ORDER BY r.created_at DESC
       LIMIT ?`
    )
    .all(limit);
}

module.exports = { getSummary, getCategoryTotals, getMonthlyTrends, getWeeklyTrends, getRecentActivity };
