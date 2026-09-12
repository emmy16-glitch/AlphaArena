// Telegram → OpenCode bridge.
// Verified against OpenCode v1.18.30 live API (see /doc):
//   GET  /global/health
//   POST /session?directory=<dir>            -> { id, ... }
//   POST /session/{id}/message?directory=<dir> body { parts:[{type:'text',text}] } -> { info, parts }
//   POST /session/{id}/abort?directory=<dir>
//   GET  /session/{id}/message?directory=<dir>
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENCODE_URL = (process.env.OPENCODE_URL || "http://127.0.0.1:4096").replace(/\/$/, "");
const OPENCODE_DIRECTORY = process.env.OPENCODE_DIRECTORY || "/home/azureuser/projects/AlphaArena";
const ALLOWED_CHAT_IDS = new Set(
  (process.env.ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

if (!BOT_TOKEN) {
  console.error("FATAL: BOT_TOKEN is not set. Put it in telegram-bot/.env (never commit it).");
  process.exit(1);
}

const SESSIONS_FILE = path.join(__dirname, "sessions.json");
const chatSessions = new Map(); // chatId -> sessionId
const inflight = new Set(); // chatIds with a request in flight

// Bounds for OpenCode HTTP calls. The prompt timeout caps the long
// /message call (coding tasks can take a while); the check timeout bounds
// the quick session/health/abort calls so a hung server can never wedge a
// chat's inflight flag forever. Overridable via env for tests/ops.
const PROMPT_TIMEOUT_MS = Number(process.env.PROMPT_TIMEOUT_MS || 120_000);
const SESSION_CHECK_TIMEOUT_MS = Number(process.env.SESSION_CHECK_TIMEOUT_MS || 15_000);

// Log the real error: Node's fetch wraps ECONNREFUSED/ECONNRESET/timeouts
// etc. in err.cause, which `err.message` alone ("fetch failed") discards.
function logError(prefix, err) {
  const msg = err && typeof err === "object" && "message" in err ? err.message : String(err);
  const extra =
    err && typeof err === "object" && "cause" in err && err.cause !== undefined ? [{ cause: err.cause }] : [];
  console.error(prefix, msg, ...extra);
}

// Every OpenCode fetch must go through here so no code path can hang
// forever holding a chat's inflight flag. On timeout the rejection is an
// AbortError annotated with timeoutMs so callers can report honestly.
async function fetchWithTimeout(url, options = {}, timeoutMs = SESSION_CHECK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && typeof err === "object" && err.name === "AbortError" && controller.signal.aborted) {
      err.timeoutMs = timeoutMs;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
      for (const [k, v] of Object.entries(data)) chatSessions.set(String(k), v);
      console.log(`Loaded ${chatSessions.size} saved chat session(s).`);
    }
  } catch (err) {
    console.error("Could not load sessions.json:", err.message);
    // Don't keep a truncated/unparseable file in place: move it aside so
    // the next save starts clean, while preserving evidence for debugging.
    try {
      const aside = `${SESSIONS_FILE}.corrupt-${Date.now()}`;
      fs.renameSync(SESSIONS_FILE, aside);
      console.error(`Moved unreadable sessions.json aside to ${aside}`);
    } catch {
      // ignore - will retry load on next start
    }
  }
}

function saveSessions() {
  try {
    // Atomic write: a crash mid-write must never leave a truncated
    // sessions.json. Write temp + rename (rename is atomic on POSIX).
    const tmp = `${SESSIONS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(chatSessions), null, 2));
    fs.renameSync(tmp, SESSIONS_FILE);
  } catch (err) {
    console.error("Could not save sessions.json:", err.message);
  }
}

function apiUrl(p) {
  const dir = encodeURIComponent(OPENCODE_DIRECTORY);
  const sep = p.includes("?") ? "&" : "?";
  return `${OPENCODE_URL}${p}${sep}directory=${dir}`;
}

async function opencodeHealth() {
  const res = await fetchWithTimeout(`${OPENCODE_URL}/global/health`, {}, SESSION_CHECK_TIMEOUT_MS);
  if (!res.ok) throw new Error(`health check failed: HTTP ${res.status}`);
  return res.json();
}

async function createSession(title) {
  const res = await fetchWithTimeout(
    apiUrl("/session"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || "telegram session" }),
    },
    SESSION_CHECK_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`session.create failed: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function abortSession(sessionId) {
  const res = await fetchWithTimeout(
    apiUrl(`/session/${sessionId}/abort`),
    { method: "POST" },
    SESSION_CHECK_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`abort failed: HTTP ${res.status}`);
  return true;
}

// POST /session/{id}/message returns JSON {info, parts} in practice,
// but the OpenAPI description says "streaming", so also handle SSE fallback.
function parsePromptResponse(raw) {
  const text = raw.trim();
  if (!text) throw new Error("empty response from OpenCode");
  try {
    return JSON.parse(text);
  } catch {
    // SSE fallback: pick the last `data: {...}` line that parses and has parts/info.
    const lines = text.split("\n");
    let last = null;
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (obj && (obj.parts || obj.info)) last = obj;
      } catch {
        // ignore partial frames
      }
    }
    if (last) return last;
    throw new Error("could not parse OpenCode response (neither JSON nor SSE)");
  }
}

function extractReplyText(data) {
  const parts = Array.isArray(data.parts) ? data.parts : [];
  const texts = parts.filter((p) => p && p.type === "text" && p.text).map((p) => p.text.trim());
  if (texts.length) return texts.join("\n\n").trim();

  // No direct text (e.g. only tool calls): summarise so Telegram isn't silent.
  const tools = parts
    .filter((p) => p && p.type === "tool")
    .map((p) => `• ${p.tool || "tool"} (${p.state?.status || "?"})`);
  const finish = data.info?.finish ? ` (finish: ${data.info.finish})` : "";
  if (tools.length) return `Done${finish}. Tool calls:\n${tools.slice(0, 20).join("\n")}`;
  return `Done${finish}, no text output.`;
}

async function promptSession(sessionId, userText) {
  const res = await fetchWithTimeout(
    apiUrl(`/session/${sessionId}/message`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: [{ type: "text", text: userText }] }),
    },
    PROMPT_TIMEOUT_MS
  );
  const raw = await res.text();
  if (!res.ok) throw new Error(`prompt failed: HTTP ${res.status} ${raw.slice(0, 500)}`);
  return parsePromptResponse(raw);
}

async function ensureSession(chatId) {
  let sid = chatSessions.get(String(chatId));
  if (sid) {
    // Validate it still exists; transparently recreate if deleted/stale.
    // Bounded by SESSION_CHECK_TIMEOUT_MS so a hung server can't wedge the chat.
    try {
      const res = await fetchWithTimeout(apiUrl(`/session/${sid}`), {}, SESSION_CHECK_TIMEOUT_MS);
      if (res.ok) return sid;
      console.log(`Saved session ${sid} for chat ${chatId} is gone (HTTP ${res.status}); creating a fresh one.`);
    } catch (err) {
      // Validation itself failed (server down/hung/timed out): fall through
      // and try to recreate. If the server is really gone, createSession's
      // own bounded timeout will fail fast with an honest AbortError.
      logError(`Session check for ${sid} failed; creating a fresh one:`, err);
    }
  }
  sid = await createSession(`telegram-${chatId}`);
  chatSessions.set(String(chatId), sid);
  saveSessions();
  return sid;
}

// Telegram caps messages at 4096 chars.
async function sendChunked(bot, chatId, text) {
  const MAX = 4000;
  const msg = text.length ? text : "(empty response)";
  for (let i = 0; i < msg.length; i += MAX) {
    // eslint-disable-next-line no-await-in-loop
    await bot.sendMessage(chatId, msg.slice(i, i + MAX));
  }
}

const HELP = [
  "🤖 *AlphaArena OpenCode Assistant*",
  "",
  "Send any coding task and I'll run it in `/home/azureuser/projects/AlphaArena` via OpenCode:",
  "• Fix bugs",
  "• Explain code",
  "• Modify files",
  "• Create features",
  "",
  "Commands:",
  "/new — start a fresh OpenCode session",
  "/status — show OpenCode health + session id",
  "/abort — stop the current run",
  "/help — this message",
].join("\n");

async function main() {
  loadSessions();

  try {
    const h = await opencodeHealth();
    console.log(`OpenCode reachable: healthy=${h.healthy} version=${h.version} url=${OPENCODE_URL}`);
  } catch (err) {
    console.error(`WARNING: OpenCode not reachable at ${OPENCODE_URL}: ${err.message}`);
    console.error("Bridge will still start; fix OpenCode (`pm2 list`, port 4096) before sending tasks.");
  }

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log("Telegram bridge is running (polling)...");

  bot.on("polling_error", (err) => console.error("Telegram polling error:", err.message));

  bot.onText(/^\/start(?:@\S+)?(?:\s|$)/, (msg) => bot.sendMessage(msg.chat.id, HELP, { parse_mode: "Markdown" }));
  bot.onText(/^\/help(?:@\S+)?(?:\s|$)/, (msg) => bot.sendMessage(msg.chat.id, HELP, { parse_mode: "Markdown" }));

  bot.onText(/^\/new(?:@\S+)?(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const sid = await createSession(`telegram-${chatId}`);
      chatSessions.set(String(chatId), sid);
      saveSessions();
      await bot.sendMessage(chatId, `🆕 New OpenCode session started:\n\`${sid}\``, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("session.create error:", err.message);
      await bot.sendMessage(chatId, `❌ Could not create session: ${err.message}`);
    }
  });

  bot.onText(/^\/status(?:@\S+)?(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const h = await opencodeHealth();
      const sid = chatSessions.get(String(chatId)) || "(none yet)";
      await bot.sendMessage(chatId, `✅ OpenCode v${h.version} healthy.\nSession: \`${sid}\``, { parse_mode: "Markdown" });
    } catch (err) {
      await bot.sendMessage(chatId, `❌ OpenCode unreachable: ${err.message}`);
    }
  });

  bot.onText(/^\/abort(?:@\S+)?(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const sid = chatSessions.get(String(chatId));
    if (!sid) return bot.sendMessage(chatId, "No active session to abort.");
    try {
      await abortSession(sid);
      inflight.delete(String(chatId));
      await bot.sendMessage(chatId, "🛑 Abort requested for current run.");
    } catch (err) {
      await bot.sendMessage(chatId, `❌ Abort failed: ${err.message}`);
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();

    if (!text || text.startsWith("/")) return; // commands handled above; ignore non-text
    if (ALLOWED_CHAT_IDS.size && !ALLOWED_CHAT_IDS.has(String(chatId))) {
      console.log(`Ignored message from unauthorized chat ${chatId}`);
      return bot.sendMessage(chatId, "⛔ This bot is private. Your chat id is not allow-listed.");
    }
    if (inflight.has(String(chatId))) {
      return bot.sendMessage(chatId, "⏳ Still working on your previous request — /abort to cancel it.");
    }

    inflight.add(String(chatId));
    try {
      await bot.sendChatAction(chatId, "typing");
      const typingTimer = setInterval(() => bot.sendChatAction(chatId, "typing").catch(() => {}), 4000);
      try {
        const sid = await ensureSession(chatId);
        console.log(`Chat ${chatId} -> session ${sid}: ${text.slice(0, 120)}`);
        const data = await promptSession(sid, text);
        const reply = extractReplyText(data);
        console.log(`Session ${sid} replied (${reply.length} chars).`);
        await sendChunked(bot, chatId, `🤖 ${reply}`);
      } finally {
        clearInterval(typingTimer);
      }
    } catch (err) {
      const isAbort = err.name === "AbortError";
      logError(`Prompt error (chat ${chatId}):`, err);
      if (isAbort) {
        const secs = Math.round((err.timeoutMs || PROMPT_TIMEOUT_MS) / 1000);
        await bot.sendMessage(
          chatId,
          `⏱️ That request timed out after ${secs}s. It may still be running on the server — check with /status, or just try again.`
        );
      } else {
        await bot.sendMessage(chatId, `❌ OpenCode error: ${err.message}`);
      }
    } finally {
      // Runs on success, caught error, or any exception: the next message
      // from this chat must never see a stale "still working" reply.
      inflight.delete(String(chatId));
    }
  });
}

// Never let an async slip outside the per-message try/catch take the whole
// bridge down (which would look exactly like a "stuck" bridge to users).
// These only log: per-chat inflight flags are owned by the message handler's
// finally block, so a logged rejection here cannot wedge any chat.
process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection:", reason instanceof Error ? reason : new Error(String(reason)));
});
process.on("uncaughtException", (err) => {
  logError("Uncaught exception (bridge stays up):", err);
});

if (require.main === module) {
  main().catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
}

// Exported for offline tests (require without running the bridge).
module.exports = {
  promptSession,
  ensureSession,
  createSession,
  abortSession,
  opencodeHealth,
  parsePromptResponse,
  extractReplyText,
  fetchWithTimeout,
  saveSessions,
  loadSessions,
  chatSessions,
  inflight,
  apiUrl,
  PROMPT_TIMEOUT_MS,
  SESSION_CHECK_TIMEOUT_MS,
};
