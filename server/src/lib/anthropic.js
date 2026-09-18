"use strict";

const Anthropic = require("@anthropic-ai/sdk").default || require("@anthropic-ai/sdk");

const CATS = [
  "食費", "日用品", "住居費", "光熱費", "通信費", "交通費",
  "交際費", "娯楽", "医療", "衣服・美容", "教育", "その他",
];

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Thrown to signal a specific {code} the frontend's receiptErrorMessage()
// already knows how to render in Japanese.
class ReceiptScanError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function buildPrompt() {
  const catList = CATS.join("、");
  return (
    "これは買い物のレシートの写真です。写っている商品を一つずつ読み取り、次のJSON形式だけで答えてください。" +
    "小計・消費税・合計・お預かり・お釣り・ポイント・割引の行は商品として含めないでください。金額は税込みの円の整数にしてください。\n" +
    '{"merchant": "店名（読み取れなければnull）", "date": "YYYY-MM-DD形式（読み取れなければnull）", ' +
    '"items": [{"name":"商品名", "price": 整数, "category": "次の中から最も近いものを一つだけ選ぶ: ' + catList + '"}]}' +
    "\nJSON以外の文章は出力しないでください。"
  );
}

function extractJson(text) {
  // Models occasionally wrap JSON in a code fence despite instructions;
  // tolerate that rather than failing the whole scan.
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

// image: { buffer, mimetype }. Returns { merchant, date, items }.
// Throws ReceiptScanError with a code the frontend already handles.
async function analyzeReceiptImage(image) {
  const anthropic = getClient();
  if (!anthropic) throw new ReceiptScanError("not_granted");
  if (!image || !image.buffer || !image.buffer.length) {
    throw new ReceiptScanError("images_unavailable");
  }

  const model = process.env.ANTHROPIC_MODEL;
  if (!model) throw new ReceiptScanError("not_granted");

  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimetype,
                data: image.buffer.toString("base64"),
              },
            },
            { type: "text", text: buildPrompt() },
          ],
        },
      ],
    });
  } catch (err) {
    if (err && (err.status === 429 || err.status === 529)) {
      throw new ReceiptScanError("rate_limited");
    }
    if (err && err.status === 400) {
      throw new ReceiptScanError("image_rejected");
    }
    throw new ReceiptScanError("invalid_json");
  }

  const textBlock = (response.content || []).find((b) => b.type === "text");
  let parsed;
  try {
    parsed = extractJson(textBlock && textBlock.text);
  } catch (e) {
    throw new ReceiptScanError("invalid_json");
  }
  if (!parsed || typeof parsed !== "object") throw new ReceiptScanError("invalid_json");

  return {
    merchant: typeof parsed.merchant === "string" ? parsed.merchant : null,
    date: typeof parsed.date === "string" ? parsed.date : null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

module.exports = { analyzeReceiptImage, ReceiptScanError };
