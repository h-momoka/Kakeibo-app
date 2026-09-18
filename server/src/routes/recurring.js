"use strict";

const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

const personKey = z.enum(["personA", "personB"]);
const scope = z.enum(["personal", "shared"]);

const recurringSchema = z.object({
  scope,
  name: z.string().min(1).max(60),
  amount: z.number().int(),
  category: z.string().min(1),
  owner: personKey.optional().nullable(),
  paidBy: personKey.optional().nullable(),
  splitPercentA: z.number().int().min(0).max(100).optional().nullable(),
});

function serialize(row) {
  const out = {
    id: row.id,
    scope: row.scope,
    name: row.name,
    amount: row.amount,
    category: row.category,
    createdAt: row.createdAt,
  };
  if (row.scope === "personal") out.owner = row.owner;
  else {
    out.paidBy = row.paidBy;
    out.splitPercentA = row.splitPercentA;
  }
  return out;
}

router.get("/", requireAuth, async (req, res) => {
  const scopeParam = scope.safeParse(req.query.scope);
  if (!scopeParam.success) return res.status(400).json({ code: "invalid_input" });
  const ownerParam = req.query.owner ? personKey.safeParse(req.query.owner) : null;

  const where = { householdId: req.auth.householdId, scope: scopeParam.data };
  if (ownerParam && ownerParam.success) where.owner = ownerParam.data;

  const rows = await prisma.recurringCost.findMany({ where, orderBy: { createdAt: "asc" } });
  res.json(rows.map(serialize));
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = recurringSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "invalid_input" });
  const data = parsed.data;

  const row = await prisma.recurringCost.create({
    data: {
      householdId: req.auth.householdId,
      scope: data.scope,
      name: data.name,
      amount: data.amount,
      category: data.category,
      owner: data.scope === "personal" ? data.owner : null,
      paidBy: data.scope === "shared" ? data.paidBy : null,
      splitPercentA: data.scope === "shared" ? data.splitPercentA : null,
    },
  });
  res.status(201).json(serialize(row));
});

router.patch("/:id", requireAuth, async (req, res) => {
  const parsed = recurringSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "invalid_input" });
  const data = parsed.data;

  const existing = await prisma.recurringCost.findFirst({
    where: { id: req.params.id, householdId: req.auth.householdId },
  });
  if (!existing) return res.status(404).json({ code: "not_found" });

  const patch = {};
  ["name", "amount", "category", "owner", "paidBy", "splitPercentA"].forEach((k) => {
    if (data[k] !== undefined) patch[k] = data[k];
  });

  const row = await prisma.recurringCost.update({ where: { id: existing.id }, data: patch });
  res.json(serialize(row));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const existing = await prisma.recurringCost.findFirst({
    where: { id: req.params.id, householdId: req.auth.householdId },
  });
  if (!existing) return res.status(404).json({ code: "not_found" });
  await prisma.recurringCost.delete({ where: { id: existing.id } });
  res.status(204).end();
});

module.exports = router;
