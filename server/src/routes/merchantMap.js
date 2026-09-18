"use strict";

const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

const learnSchema = z.object({
  pairs: z.record(z.string().min(1), z.string().min(1)),
});

router.get("/", requireAuth, async (req, res) => {
  const rows = await prisma.merchantMapEntry.findMany({ where: { householdId: req.auth.householdId } });
  const map = {};
  rows.forEach((r) => { map[r.keyword] = r.category; });
  res.json(map);
});

// Mirrors Store.learnMerchants(pairs): merges {keyword: category} pairs in.
router.post("/", requireAuth, async (req, res) => {
  const parsed = learnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "invalid_input" });
  const entries = Object.entries(parsed.data.pairs);
  if (!entries.length) return res.status(204).end();

  await prisma.$transaction(
    entries.map(([keyword, category]) =>
      prisma.merchantMapEntry.upsert({
        where: { householdId_keyword: { householdId: req.auth.householdId, keyword } },
        create: { householdId: req.auth.householdId, keyword, category },
        update: { category },
      })
    )
  );
  res.status(204).end();
});

module.exports = router;
