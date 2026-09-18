"use strict";

const prisma = require("./prisma");

function startOfTodayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfThisMonthUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Two-tier cost control for the receipt-scan endpoint, which is the only
// endpoint that spends the operator's own Anthropic API key:
//  - per-household monthly cap, so one household can't run up the bill
//  - global daily cap across every household, a hard ceiling on total spend
async function checkReceiptScanQuota(householdId) {
  const householdLimit = parseInt(process.env.RECEIPT_SCAN_HOUSEHOLD_MONTHLY_LIMIT, 10) || 100;
  const globalLimit = parseInt(process.env.RECEIPT_SCAN_GLOBAL_DAILY_LIMIT, 10) || 200;

  const [householdCount, globalCount] = await Promise.all([
    prisma.receiptScanUsage.count({
      where: { householdId, createdAt: { gte: startOfThisMonthUTC() } },
    }),
    prisma.receiptScanUsage.count({
      where: { createdAt: { gte: startOfTodayUTC() } },
    }),
  ]);

  if (householdCount >= householdLimit) {
    return { allowed: false, reason: "household_monthly_limit" };
  }
  if (globalCount >= globalLimit) {
    return { allowed: false, reason: "global_daily_limit" };
  }
  return { allowed: true };
}

async function recordReceiptScanUsage(householdId, userId) {
  await prisma.receiptScanUsage.create({ data: { householdId, userId } });
}

module.exports = { checkReceiptScanQuota, recordReceiptScanUsage };
