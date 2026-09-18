"use strict";

const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

const personKey = z.enum(["personA", "personB"]);
const scope = z.enum(["personal", "shared"]);

const expenseSchema = z.object({
  scope,
  amount: z.number().int(),
  category: z.string().min(1),
  memo: z.string().max(200).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  owner: personKey.optional().nullable(),
  paidBy: personKey.optional().nullable(),
  splitPercentA: z.number().int().min(0).max(100).optional().nullable(),
  settled: z.boolean().optional(),
  settledAt: z.string().datetime().optional().nullable(),
  receiptAssetId: z.string().optional().nullable(),
  recurringId: z.string().optional().nullable(),
  recurringMonth: z.string().optional().nullable(),
  createdAt: z.string().datetime().optional(),
});

function serialize(row) {
  const out = {
    id: row.id,
    scope: row.scope,
    amount: row.amount,
    category: row.category,
    memo: row.memo,
    date: row.date,
    createdAt: row.createdAt,
    receiptAssetId: row.receiptAssetId || undefined,
    recurringId: row.recurringId || undefined,
    recurringMonth: row.recurringMonth || undefined,
  };
  if (row.scope === "personal") {
    out.owner = row.owner;
  } else {
    out.paidBy = row.paidBy;
    out.splitPercentA = row.splitPercentA;
    out.settled = row.settled;
    out.settledAt = row.settledAt || undefined;
  }
  return out;
}

router.get("/", requireAuth, async (req, res) => {
  const scopeParam = scope.safeParse(req.query.scope);
  if (!scopeParam.success) return res.status(400).json({ code: "invalid_input" });
  const ownerParam = req.query.owner ? personKey.safeParse(req.query.owner) : null;

  const where = { householdId: req.auth.householdId, scope: scopeParam.data };
  if (ownerParam && ownerParam.success) where.owner = ownerParam.data;

  const rows = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    take: 500,
  });
  res.json(rows.map(serialize));
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "invalid_input", message: parsed.error.issues[0].message });
  const data = parsed.data;

  const row = await prisma.expense.create({
    data: {
      householdId: req.auth.householdId,
      scope: data.scope,
      amount: data.amount,
      category: data.category,
      memo: data.memo || "",
      date: data.date,
      owner: data.scope === "personal" ? data.owner : null,
      paidBy: data.scope === "shared" ? data.paidBy : null,
      splitPercentA: data.scope === "shared" ? data.splitPercentA : null,
      settled: data.scope === "shared" ? !!data.settled : false,
      settledAt: data.settledAt ? new Date(data.settledAt) : null,
      receiptAssetId: data.receiptAssetId || null,
      recurringId: data.recurringId || null,
      recurringMonth: data.recurringMonth || null,
      ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
    },
  });
  res.status(201).json(serialize(row));
});

router.patch("/:id", requireAuth, async (req, res) => {
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "invalid_input" });
  const data = parsed.data;

  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, householdId: req.auth.householdId },
  });
  if (!existing) return res.status(404).json({ code: "not_found" });

  const patch = {};
  ["amount", "category", "memo", "date", "owner", "paidBy", "splitPercentA", "settled",
    "receiptAssetId", "recurringId", "recurringMonth"].forEach((k) => {
    if (data[k] !== undefined) patch[k] = data[k];
  });
  if (data.settledAt !== undefined) patch.settledAt = data.settledAt ? new Date(data.settledAt) : null;

  const row = await prisma.expense.update({ where: { id: existing.id }, data: patch });
  res.json(serialize(row));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, householdId: req.auth.householdId },
  });
  if (!existing) return res.status(404).json({ code: "not_found" });
  await prisma.expense.delete({ where: { id: existing.id } });
  res.status(204).end();
});

module.exports = router;
