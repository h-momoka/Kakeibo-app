"use strict";

const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { hashPassword, verifyPassword, requireAuth } = require("../lib/auth");
const { generateInviteCode } = require("../lib/inviteCode");

const router = express.Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});
const joinSchema = signupSchema.extend({
  inviteCode: z.string().min(1),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    personKey: user.personKey,
    household: { id: user.householdId, inviteCode: user.household.inviteCode },
  };
}

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "invalid_input", message: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ code: "email_taken", message: "このメールアドレスは既に使われています。" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const household = await tx.household.create({ data: { inviteCode: generateInviteCode() } });
    return tx.user.create({
      data: { email, passwordHash, householdId: household.id, personKey: "personA" },
      include: { household: true },
    });
  });

  req.session.userId = user.id;
  res.status(201).json(serializeUser(user));
});

router.post("/join", async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "invalid_input", message: parsed.error.issues[0].message });
  }
  const { email, password, inviteCode } = parsed.data;

  const household = await prisma.household.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
    include: { users: true },
  });
  if (!household) {
    return res.status(404).json({ code: "invite_code_not_found", message: "招待コードが見つかりません。" });
  }
  if (household.users.some((u) => u.personKey === "personB")) {
    return res.status(409).json({ code: "household_full", message: "この世帯には既にもう一人参加しています。" });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ code: "email_taken", message: "このメールアドレスは既に使われています。" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, householdId: household.id, personKey: "personB" },
    include: { household: true },
  });

  req.session.userId = user.id;
  res.status(201).json(serializeUser(user));
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "invalid_input" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, include: { household: true } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ code: "invalid_credentials", message: "メールアドレスまたはパスワードが違います。" });
  }

  req.session.userId = user.id;
  res.json(serializeUser(user));
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("kakeibo.sid");
    res.status(204).end();
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, include: { household: true } });
  res.json(serializeUser(user));
});

module.exports = router;
