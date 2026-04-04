const request = require("supertest");
const app = require("../src/app");
const { closeDb } = require("../src/models/db");


process.env.NODE_ENV = "test";

afterAll(() => closeDb());


async function register(data) {
  return request(app).post("/api/v1/auth/register").send(data);
}

async function login(email, password = "password123") {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  return res.body.data?.token;
}

async function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}


describe("Auth", () => {
  test("first registration becomes admin", async () => {
    const res = await register({ name: "Admin", email: "admin@test.com", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("admin");
  });

  test("login returns JWT", async () => {
    const token = await login("admin@test.com");
    expect(token).toBeTruthy();
  });

  test("login with wrong password returns 401", async () => {
    const res = await request(app).post("/api/v1/auth/login")
      .send({ email: "admin@test.com", password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  test("GET /auth/me returns current user", async () => {
    const token = await login("admin@test.com");
    const res = await request(app).get("/api/v1/auth/me")
      .set(await authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("admin@test.com");
  });
});

describe("Role-based access", () => {
  let adminToken, viewerToken;

  beforeAll(async () => {
    adminToken = await login("admin@test.com");
  
    await request(app).post("/api/v1/auth/register")
      .send({ name: "Viewer", email: "viewer@test.com", password: "password123", role: "viewer" });
    viewerToken = await login("viewer@test.com");
  });

  test("viewer cannot create a record", async () => {
    const res = await request(app)
      .post("/api/v1/records")
      .set(await authHeader(viewerToken))
      .send({ amount: 100, type: "income", category: "Salary", date: "2024-01-15" });
    expect(res.status).toBe(403);
  });

  test("viewer cannot list users", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set(await authHeader(viewerToken));
    expect(res.status).toBe(403);
  });

  test("admin can list users", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set(await authHeader(adminToken));
    expect(res.status).toBe(200);
  });
});


describe("Financial Records", () => {
  let adminToken, recordId;

  beforeAll(async () => {
    adminToken = await login("admin@test.com");
  });

  test("create a record", async () => {
    const res = await request(app)
      .post("/api/v1/records")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ amount: 500, type: "income", category: "Salary", date: "2024-03-01", notes: "March salary" });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(500);
    recordId = res.body.data.id;
  });

  test("list records", async () => {
    const res = await request(app)
      .get("/api/v1/records")
      .set({ Authorization: `Bearer ${adminToken}` });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.records)).toBe(true);
  });

  test("filter records by type", async () => {
    const res = await request(app)
      .get("/api/v1/records?type=income")
      .set({ Authorization: `Bearer ${adminToken}` });
    expect(res.status).toBe(200);
    res.body.data.records.forEach((r) => expect(r.type).toBe("income"));
  });

  test("update a record", async () => {
    const res = await request(app)
      .patch(`/api/v1/records/${recordId}`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ notes: "Updated notes" });
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe("Updated notes");
  });

  test("delete a record (soft)", async () => {
    const res = await request(app)
      .delete(`/api/v1/records/${recordId}`)
      .set({ Authorization: `Bearer ${adminToken}` });
    expect(res.status).toBe(204);
  });

  test("deleted record not in list", async () => {
    const res = await request(app)
      .get("/api/v1/records")
      .set({ Authorization: `Bearer ${adminToken}` });
    const ids = res.body.data.records.map((r) => r.id);
    expect(ids).not.toContain(recordId);
  });
});


describe("Dashboard", () => {
  let token;
  beforeAll(async () => { token = await login("admin@test.com"); });

  test("summary returns net balance", async () => {
    const res = await request(app).get("/api/v1/dashboard/summary")
      .set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.net_balance).toBe("number");
  });

  test("category totals", async () => {
    const res = await request(app).get("/api/v1/dashboard/categories")
      .set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("monthly trends", async () => {
    const res = await request(app).get("/api/v1/dashboard/trends/monthly")
      .set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });
});


describe("Input Validation", () => {
  let token;
  beforeAll(async () => { token = await login("admin@test.com"); });

  test("rejects negative amount", async () => {
    const res = await request(app)
      .post("/api/v1/records")
      .set({ Authorization: `Bearer ${token}` })
      .send({ amount: -50, type: "income", category: "X", date: "2024-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  test("rejects invalid date format", async () => {
    const res = await request(app)
      .post("/api/v1/records")
      .set({ Authorization: `Bearer ${token}` })
      .send({ amount: 50, type: "income", category: "X", date: "01-01-2024" });
    expect(res.status).toBe(400);
  });

  test("rejects invalid role on update", async () => {
    const usersRes = await request(app).get("/api/v1/users")
      .set({ Authorization: `Bearer ${token}` });
    const id = usersRes.body.data.users[0].id;
    const res = await request(app)
      .patch(`/api/v1/users/${id}`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ role: "superuser" });
    expect(res.status).toBe(400);
  });
});
