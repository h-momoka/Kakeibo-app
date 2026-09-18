"use strict";

const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");

function createSessionMiddleware() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  return session({
    store: new pgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    name: "kakeibo.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  });
}

module.exports = { createSessionMiddleware };
