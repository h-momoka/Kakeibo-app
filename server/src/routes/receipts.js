"use strict";

const express = require("express");
const multer = require("multer");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../lib/auth");
const { analyzeReceiptImage, ReceiptScanError } = require("../lib/anthropic");
const { checkReceiptScanQuota, recordReceiptScanUsage } = require("../lib/quota");

const router = express.Router();

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"));
      return;
    }
    cb(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ code: "image_rejected" });
    next();
  });
}

// Store the original photo (assetsApi.upload equivalent). Kept separate from
// /scan, mirroring the frontend firing both requests in parallel.
router.post("/", requireAuth, handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ code: "images_unavailable" });

  const asset = await prisma.receiptAsset.create({
    data: {
      householdId: req.auth.householdId,
      imageBytes: req.file.buffer,
      mimeType: req.file.mimetype,
    },
  });
  res.status(201).json({ id: asset.id });
});

router.get("/:id", requireAuth, async (req, res) => {
  const asset = await prisma.receiptAsset.findFirst({
    where: { id: req.params.id, householdId: req.auth.householdId },
  });
  if (!asset) return res.status(404).end();
  res.setHeader("Content-Type", asset.mimeType);
  res.send(Buffer.from(asset.imageBytes));
});

// sampleApi.json(...) equivalent: runs the vision call against the
// operator's own Anthropic key, gated by the two-tier quota in lib/quota.js.
router.post("/scan", requireAuth, handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ code: "images_unavailable" });

  const quota = await checkReceiptScanQuota(req.auth.householdId);
  if (!quota.allowed) {
    return res.status(429).json({ code: "rate_limited" });
  }

  try {
    const result = await analyzeReceiptImage({ buffer: req.file.buffer, mimetype: req.file.mimetype });
    await recordReceiptScanUsage(req.auth.householdId, req.auth.userId);
    res.json(result);
  } catch (err) {
    if (err instanceof ReceiptScanError) {
      const status = err.code === "rate_limited" ? 429 : err.code === "not_granted" ? 503 : 400;
      return res.status(status).json({ code: err.code });
    }
    res.status(500).json({ code: "invalid_json" });
  }
});

module.exports = router;
