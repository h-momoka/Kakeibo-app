"use strict";

const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

router.get("/invite-code", requireAuth, async (req, res) => {
  const household = await prisma.household.findUnique({
    where: { id: req.auth.householdId },
    include: { users: true },
  });
  res.json({
    inviteCode: household.inviteCode,
    partnerJoined: household.users.some((u) => u.personKey !== req.auth.personKey),
  });
});

module.exports = router;
