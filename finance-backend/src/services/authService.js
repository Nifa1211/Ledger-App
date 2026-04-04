const bcrypt = require("bcryptjs");
const { getDb } = require("../models/db");
const { signToken } = require("../middleware/auth");

const SALT_ROUNDS = 10;


async function register({ name, email, password, role = "viewer" }, requestingUser) {
  const db = getDb();


  const count = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const assignedRole = count === 0 ? "admin" : role;

  if (requestingUser && requestingUser.role !== "admin" && assignedRole !== "viewer") {
    throw Object.assign(new Error("Only admins can create analyst or admin accounts"), { status: 403 });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    throw Object.assign(new Error("Email already registered"), { status: 409 });
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const result = db
    .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
    .run(name, email, hashed, assignedRole);

  return {
    id: result.lastInsertRowid,
    name,
    email,
    role: assignedRole,
    status: "active",
  };
}


async function login({ email, password }) {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user) throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  if (user.status === "inactive") throw Object.assign(new Error("Account is inactive"), { status: 403 });

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw Object.assign(new Error("Invalid email or password"), { status: 401 });

  const token = signToken(user.id);
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

module.exports = { register, login };
