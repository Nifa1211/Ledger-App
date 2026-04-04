
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { getDb, closeDb } = require("../models/db");

const DATA_DIR = path.join(__dirname, "../../data");
fs.mkdirSync(DATA_DIR, { recursive: true });

async function seed() {
  const db = getDb();

  console.log("Seeding users...");
  const password = await bcrypt.hash("password123", 10);

  const users = [
    { name: "Alice Admin",   email: "admin@example.com",   role: "admin" },
    { name: "Bob Analyst",   email: "analyst@example.com", role: "analyst" },
    { name: "Carol Viewer",  email: "viewer@example.com",  role: "viewer" },
  ];

  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
  );
  users.forEach((u) => insertUser.run(u.name, u.email, password, u.role));

  const adminId = db.prepare("SELECT id FROM users WHERE email = 'admin@example.com'").get().id;

  console.log("Seeding financial records...");
  const categories = ["Salary", "Rent", "Groceries", "Utilities", "Entertainment", "Freelance", "Transport"];
  const insertRecord = db.prepare(
    "INSERT INTO financial_records (amount, type, category, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  );

  db.exec("BEGIN");
  try {
    for (let i = 0; i < 60; i++) {
      const daysAgo = Math.floor(Math.random() * 365);
      const date = new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];
      const type = Math.random() > 0.4 ? "expense" : "income";
      const amount = parseFloat((Math.random() * 4900 + 100).toFixed(2));
      const category = categories[Math.floor(Math.random() * categories.length)];
      insertRecord.run(amount, type, category, date, `Sample ${type} entry #${i + 1}`, adminId);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log("✅ Seed complete. Login credentials: password123 for all users.");
  closeDb();
}

seed().catch((err) => { console.error(err); process.exit(1); });
