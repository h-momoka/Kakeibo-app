"use strict";

const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

const profileFields = z.object({
  personAName: z.string().min(1).max(30).optional(),
  personBName: z.string().min(1).max(30).optional(),
  personAColor: z.string().regex(/^#[0-9A-Fa-f]{3,6}$/).optional(),
  personBColor: z.string().regex(/^#[0-9A-Fa-f]{3,6}$/).optional(),
  personAIncome: z.number().int().min(0).optional(),
  personBIncome: z.number().int().min(0).optional(),
});

function serialize(profile) {
  if (!profile) return null;
  return {
    personAName: profile.personAName,
    personBName: profile.personBName,
    personAColor: profile.personAColor,
    personBColor: profile.personBColor,
    personAIncome: profile.personAIncome,
    personBIncome: profile.personBIncome,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const profile = await prisma.householdProfile.findUnique({ where: { householdId: req.auth.householdId } });
  res.json(serialize(profile));
});

// Full set (mirrors Store.setProfile) — upserts with defaults for anything omitted.
router.put("/", requireAuth, async (req, res) => {
  const parsed = profileFields.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "invalid_input" });

  const profile = await prisma.householdProfile.upsert({
    where: { householdId: req.auth.householdId },
    create: { householdId: req.auth.householdId, ...parsed.data },
    update: parsed.data,
  });
  res.json(serialize(profile));
});

// Partial update (mirrors Store.updateProfile) — merges into existing/defaults.
router.patch("/", requireAuth, async (req, res) => {
  const parsed = profileFields.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "invalid_input" });

  const profile = await prisma.householdProfile.upsert({
    where: { householdId: req.auth.householdId },
    create: { householdId: req.auth.householdId, ...parsed.data },
    update: parsed.data,
  });
  res.json(serialize(profile));
});

module.exports = router;
