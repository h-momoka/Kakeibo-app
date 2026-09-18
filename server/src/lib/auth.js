"use strict";

const bcrypt = require("bcryptjs");
const prisma = require("./prisma");

const BCRYPT_ROUNDS = 12;

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Loads the logged-in user + household + profile onto req.auth.
// Responds 401 {code:"unauthenticated"} if there is no valid session.
async function requireAuth(req, res, next) {
  const userId = req.session && req.session.userId;
  if (!userId) {
    return res.status(401).json({ code: "unauthenticated" });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { household: true },
  });
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ code: "unauthenticated" });
  }
  req.auth = {
    userId: user.id,
    email: user.email,
    personKey: user.personKey,
    householdId: user.householdId,
    household: user.household,
  };
  next();
}

module.exports = { hashPassword, verifyPassword, requireAuth };
