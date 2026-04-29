const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));


app.use(express.json());


app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
  })
);


const FRONTEND_PATH = path.join(__dirname, "../../finance-frontend/build");
app.use(express.static(FRONTEND_PATH));


app.use("/api/v1", routes);


app.get("/health", (req, res) => res.json({ status: "ok" }));


app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});


app.use("/api", (req, res) => res.status(404).json({ error: "Route not found" }));


app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = status < 500 ? err.message : "Internal server error";
  if (status >= 500) console.error("[ERROR]", err);
  res.status(status).json({ error: message });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const fs = require("fs");
  fs.mkdirSync(path.join(__dirname, "../data"), { recursive: true });
  app.listen(PORT, () => {
    console.log(`Finance API + UI running on http://localhost:${PORT}`);
  });
}
