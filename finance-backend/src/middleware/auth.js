const jwt = require("jsonwebtoken");
const { getDb } = require("../models/db");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_in_production";


const ROLE_LEVEL = { viewer: 0, analyst: 1, admin: 2 };


function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = getDb()
    .prepare("SELECT id, name, email, role, status FROM users WHERE id = ?")
    .get(payload.sub);

  if (!user) return res.status(401).json({ error: "User not found" });
  if (user.status === "inactive") return res.status(403).json({ error: "Account is inactive" });

  req.user = user;
  next();
}


function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const userLevel = ROLE_LEVEL[req.user.role] ?? -1;
    const requiredLevel = ROLE_LEVEL[minRole] ?? 999;
    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: `Insufficient permissions. Required: ${minRole}, your role: ${req.user.role}`,
      });
    }
    next();
  };
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "8h" });
}

module.exports = { authenticate, requireRole, signToken };
