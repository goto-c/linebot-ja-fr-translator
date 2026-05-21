require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const { detectLanguage, translate } = require("./translator");

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken,
});

const app = express();

// LINE webhook endpoint — uses raw body for signature verification
app.post(
  "/webhook",
  line.middleware(lineConfig),
  async (req, res) => {
    res.sendStatus(200); // Respond to LINE immediately

    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
  }
);

/**
 * Returns the source ID (groupId, roomId, or userId) from the event.
 */
function getSourceId(event) {
  const src = event.source;
  return src.groupId ?? src.roomId ?? src.userId;
}

/**
 * Checks whether the event source is in the allowlist.
 * If ALLOWED_IDS is empty, all sources are permitted.
 */
function isAllowed(event) {
  const raw = process.env.ALLOWED_IDS ?? "";
  const allowlist = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowlist.length === 0) return true;
  return allowlist.includes(getSourceId(event));
}

async function handleEvent(event) {
  // Only handle text messages
  if (event.type !== "message" || event.message.type !== "text") return;

  const sourceId = getSourceId(event);
  const sourceType = event.source.type;   // "group" | "room" | "user"
  const userId = event.source.userId ?? "unknown";
  const timestamp = new Date(event.timestamp).toISOString();

  // Restrict to allowed group/user IDs
  if (!isAllowed(event)) {
    console.log(`[${timestamp}] IGNORED | ${sourceType}=${sourceId} user=${userId}`);
    return;
  }

  const text = event.message.text.trim();
  if (!text) return;

  const lang = detectLanguage(text);

  // Ignore messages that are neither Japanese nor French
  if (lang === "unknown") {
    console.log(`[${timestamp}] SKIP (unknown lang) | ${sourceType}=${sourceId} user=${userId} text="${text}"`);
    return;
  }

  console.log(`[${timestamp}] RECEIVED | ${sourceType}=${sourceId} user=${userId} lang=${lang} text="${text}"`);

  let translated;
  try {
    translated = await translate(text, lang);
  } catch (err) {
    console.error(`[${timestamp}] ERROR | translation failed:`, err.message);
    translated = "翻訳中にエラーが発生しました / Une erreur est survenue lors de la traduction.";
  }

  if (!translated) return;

  const replyToken = event.replyToken;
  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text: translated }],
  });

  console.log(`[${timestamp}] REPLIED | ${sourceType}=${sourceId} translated="${translated}"`);
}

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LINE translation bot listening on port ${PORT}`);
});
