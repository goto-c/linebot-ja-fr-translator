const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

/**
 * Detects whether the text is primarily Japanese or French.
 * Returns "ja", "fr", or "unknown".
 */
function detectLanguage(text) {
  // Japanese: Hiragana, Katakana, or CJK Unified Ideographs
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
  if (hasJapanese) return "ja";

  // French heuristic: ASCII + accented Latin characters
  // Require at least one accented char or common French patterns
  const hasFrenchAccent = /[àâäéèêëïîôöùûüç]/i.test(text);
  const isLatin = /^[a-zA-Z\s\u00C0-\u024F0-9.,!?'"()\-:;]+$/.test(text.trim());
  if (isLatin || hasFrenchAccent) return "fr";

  return "unknown";
}

/**
 * Translates text using Claude.
 * @param {string} text - Source text
 * @param {"ja"|"fr"} sourceLang - Source language
 * @returns {Promise<string>} Translated text
 */
async function translate(text, sourceLang) {
  const [fromLabel, toLabel] =
    sourceLang === "ja"
      ? ["日本語", "フランス語"]
      : ["フランス語", "日本語"];

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `次のテキストを${fromLabel}から${toLabel}に翻訳してください。翻訳文のみを返してください。説明や注釈は不要です。\n\n${text}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  return block ? block.text.trim() : "";
}

module.exports = { detectLanguage, translate };
