# Finance Dashboard Backend

A clean, role-based REST API for managing financial records and serving dashboard analytics. Built with Node.js, Express, and SQLite (via Node 22's built-in `node:sqlite` — no native compilation required).

---

## Tech Stack

| Layer        | Choice                             | Reason                                           |
|--------------|------------------------------------|--------------------------------------------------|
| Runtime      | Node.js 22                         | Built-in SQLite, no native dep compilation       |
| Framework    | Express 4                          | Minimal, well-understood, easy to structure      |
| Database     | SQLite (`node:sqlite`)             | Zero-config, self-contained, great for assessment|
| Auth         | JWT (jsonwebtoken)                 | Stateless, simple to verify in middleware        |
| Validation   | Zod                                | Schema-first, clean error messages               |
| Password     | bcryptjs                           | Pure-JS bcrypt, no native build needed           |
| Testing      | Jest + Supertest                   | Integration tests against real app instance      |

---

## Project Structure

```
finance-backend/
├── src/
│   ├── app.js                    # Express app + global middleware + error handler
│   ├── routes/
│   │   └── index.js              # All route definitions with auth/role guards inline
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── recordController.js
│   │   └── dashboardController.js
│   ├── services/
│   │   ├── authService.js        # Register + login business logic
│   │   ├── userService.js        # User CRUD
│   │   ├── recordService.js      # Financial record CRUD + soft delete
│   │   └── dashboardService.js   # Aggregation queries
│   ├── middleware/
│   │   ├── auth.js               # JWT verification + requireRole() guard
│   │   └── validate.js           # Zod schemas + validate() middleware factory
│   ├── models/
│   │   └── db.js                 # SQLite singleton, schema init
│   └── utils/
│       └── seed.js               # Demo data seeder
├── tests/
│   └── api.test.js               # 19 integration tests
├── data/                         # SQLite file lives here (auto-created, gitignored)
└── package.json
```

---

## Setup & Running

### Prerequisites
- Node.js **22+** (uses built-in `node:sqlite`)

### Install
```bash
npm install
```

### Start (development)
```bash
npm run dev
# API available at http://localhost:3000
```

### Seed demo data
```bash
npm run seed
```
Creates three users (all with password `password123`):

| Email                  | Role    |
|------------------------|---------|
| admin@example.com      | admin   |
| analyst@example.com    | analyst |
| viewer@example.com     | viewer  |

### Run tests
```bash
npm test
# 19 integration tests, uses in-memory SQLite, no setup needed
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. Protected endpoints require:
```
Authorization: Bearer <token>
```

### Auth

| Method | Path               | Auth     | Description                            |
|--------|--------------------|----------|----------------------------------------|
| POST   | `/auth/register`   | None*    | Register a user                        |
| POST   | `/auth/login`      | None     | Login, returns JWT                     |
| GET    | `/auth/me`         | Any      | Current user info                      |

\* The **first** registration always becomes `admin` (bootstrap). Subsequent registrations default to `viewer`. Only admins can assign `analyst` or `admin` roles.

**Register**
```json
POST /api/v1/auth/register
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123",
  "role": "viewer"          // optional; ignored unless caller is admin
}
```

**Login**
```json
POST /api/v1/auth/login
{ "email": "admin@example.com", "password": "password123" }

// Response
{ "data": { "token": "eyJ...", "user": { "id": 1, "role": "admin", ... } } }
```

---

### Users (admin only)

| Method | Path          | Description            |
|--------|---------------|------------------------|
| GET    | `/users`      | List all users         |
| GET    | `/users/:id`  | Get single user        |
| PATCH  | `/users/:id`  | Update name/role/status|
| DELETE | `/users/:id`  | Delete user            |

**Update user**
```json
PATCH /api/v1/users/2
{ "role": "analyst", "status": "inactive" }
```

---

### Financial Records

| Method | Path            | Min Role | Description                     |
|--------|-----------------|----------|---------------------------------|
| GET    | `/records`      | viewer   | List records (paginated+filtered)|
| GET    | `/records/:id`  | viewer   | Get single record               |
| POST   | `/records`      | analyst  | Create record                   |
| PATCH  | `/records/:id`  | analyst  | Update record                   |
| DELETE | `/records/:id`  | admin    | Soft-delete record              |

**Query parameters for GET /records:**
| Param      | Type   | Example        |
|------------|--------|----------------|
| type       | string | `income`       |
| category   | string | `Salary`       |
| date_from  | date   | `2024-01-01`   |
| date_to    | date   | `2024-12-31`   |
| page       | int    | `1`            |
| limit      | int    | `20` (max 100) |

**Create record**
```json
POST /api/v1/records
{
  "amount": 3500.00,
  "type": "income",
  "category": "Salary",
  "date": "2024-03-01",
  "notes": "March salary"
}
```

---

### Dashboard (any authenticated user)

| Method | Path                          | Description                      |
|--------|-------------------------------|----------------------------------|
| GET    | `/dashboard/summary`          | Total income, expenses, net      |
| GET    | `/dashboard/categories`       | Per-category totals              |
| GET    | `/dashboard/trends/monthly`   | Monthly income/expense trend     |
| GET    | `/dashboard/trends/weekly`    | Weekly income/expense trend      |
| GET    | `/dashboard/recent-activity`  | Latest N records                 |

**Summary response:**
```json
{
  "data": {
    "total_income": 15000.00,
    "total_expenses": 8750.50,
    "net_balance": 6249.50,
    "total_records": 42
  }
}
```

**Monthly trends (query: `?months=6`):**
```json
{
  "data": [
    { "month": "2024-01", "income": 3500, "expenses": 1200, "net": 2300 },
    ...
  ]
}
```

---

## Role Matrix

| Action                        | Viewer | Analyst | Admin |
|-------------------------------|--------|---------|-------|
| Login / register              | ✅     | ✅      | ✅    |
| View dashboard                | ✅     | ✅      | ✅    |
| View financial records        | ✅     | ✅      | ✅    |
| Create / update records       | ❌     | ✅      | ✅    |
| Delete records (soft)         | ❌     | ❌      | ✅    |
| Manage users                  | ❌     | ❌      | ✅    |

---

## Error Responses

All errors follow a consistent structure:
```json
{ "error": "Human-readable message" }
```

Validation errors include field-level detail:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "amount", "message": "Number must be greater than 0" },
    { "field": "date",   "message": "Date must be YYYY-MM-DD" }
  ]
}
```

| Status | Meaning                              |
|--------|--------------------------------------|
| 400    | Validation error / bad request       |
| 401    | Missing or invalid token             |
| 403    | Insufficient role / inactive account |
| 404    | Resource not found                   |
| 409    | Conflict (e.g. duplicate email)      |
| 429    | Rate limit exceeded                  |
| 500    | Internal server error                |

---

## Design Decisions & Assumptions

**Soft delete for records:** Financial data should not be hard-deleted for auditability. Deleted records get a `deleted_at` timestamp and are excluded from all queries and aggregates.

**Role hierarchy (not a flat permission list):** Roles are ordered — `viewer < analyst < admin`. The `requireRole(minRole)` guard checks level, so any future role additions slot in cleanly.

**First-user bootstrap:** The first `POST /auth/register` call always creates an admin, making the system self-bootstrapping without a separate seed step for auth.

**Analysts can write, only admins can delete:** Destruction of financial data is a higher-privilege action than creation, reflecting real-world finance systems where deletion requires sign-off.

**JWT expiry of 8 hours:** Reasonable session length for a dashboard tool. No refresh token implementation to keep scope clean; easily extendable.

**node:sqlite over better-sqlite3:** Eliminates native compilation, making setup frictionless across environments. The API surface is nearly identical. The `ExperimentalWarning` can be suppressed with `--no-warnings` in production.

**Rate limiting at 200 req/15min:** Prevents trivial brute-force on the login endpoint. In production, the login route would have a tighter, dedicated limiter.

---

## Possible Extensions

- Refresh tokens for longer sessions
- Soft delete on users (instead of hard delete)
- Audit log table tracking who changed what and when
- Export to CSV endpoint for records
- `search` query parameter on records (full-text over notes/category)
- Tighter per-route rate limiting on `/auth/login`
