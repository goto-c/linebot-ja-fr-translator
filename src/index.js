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

async function handleEvent(event) {
  // Only handle text messages
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim();
  if (!text) return;

  const lang = detectLanguage(text);

  // Ignore messages that are neither Japanese nor French
  if (lang === "unknown") return;

  let translated;
  try {
    translated = await translate(text, lang);
  } catch (err) {
    console.error("Translation error:", err);
    translated = "翻訳中にエラーが発生しました / Une erreur est survenue lors de la traduction.";
  }

  if (!translated) return;

  const replyToken = event.replyToken;
  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text: translated }],
  });
}

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LINE translation bot listening on port ${PORT}`);
});
