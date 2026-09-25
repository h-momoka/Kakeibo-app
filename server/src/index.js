"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
// Patches Express so a rejected promise inside an async route handler (e.g.
// a Prisma call failing because the database is unreachable) is passed to
// the error-handling middleware below, instead of becoming an unhandled
// rejection that crashes the whole process on a single bad request.
require("express-async-errors");
const { createSessionMiddleware } = require("./lib/session");

// Last-resort safety net: log and keep serving other requests rather than
// let one unexpected rejection anywhere take the whole server down.
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});

const authRoutes = require("./routes/auth");
const householdRoutes = require("./routes/household");
const profileRoutes = require("./routes/profile");
const expensesRoutes = require("./routes/expenses");
const recurringRoutes = require("./routes/recurring");
const merchantMapRoutes = require("./routes/merchantMap");
const receiptsRoutes = require("./routes/receipts");

for (const required of ["DATABASE_URL", "SESSION_SECRET"]) {
  if (!process.env[required]) {
    console.error(`[startup] missing required env var ${required}`);
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1); // Render sits behind a proxy; needed for secure cookies

app.use(express.json({ limit: "1mb" }));
app.use(createSessionMiddleware());

app.use("/api/auth", authRoutes);
app.use("/api/household", householdRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/merchant-map", merchantMapRoutes);
app.use("/api/receipts", receiptsRoutes);

// Frontend lives one directory up from server/ (index.html, styles.css, js/).
const frontendRoot = path.join(__dirname, "..", "..");
app.use(express.static(frontendRoot));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendRoot, "index.html"));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: "internal_error" });
});

const port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port, () => {
  console.log(`kakeibo server listening on http://localhost:${port}`);
});
