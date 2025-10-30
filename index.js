const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const clanUrl = process.env.CLAN_URL;

if (!token || !clanUrl) {
  console.error("❌ Не указан TELEGRAM_BOT_TOKEN или CLAN_URL в .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// ============================
// 📋 Получение списка игроков
// ============================
async function getPlayerNames() {
  try {
    const { data } = await axios.get(clanUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.1 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    const names = [];
    $("a[href^='/player/']").each((i, el) => {
      const name = $(el).text().trim();
      if (name && !/player list/i.test(name)) names.push(name);
    });

    return names;
  } catch (err) {
    console.error("Ошибка при получении списка:", err.message);
    return null;
  }
}

// ============================
// ⚔️ Сравнение статистики игроков
// ============================
async function getPlayerStats(name) {
  try {
    const url = `https://ddnet.org/players/${encodeURIComponent(name)}/`;
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.1 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    const stats = {};

    // Пример: ищем строку "Ranks points: 1234"
    $("table.stats tr").each((_, el) => {
      const key = $(el).find("th").text().trim();
      const val = $(el).find("td").text().trim();
      if (key && val) stats[key] = val;
    });

    return stats;
  } catch (err) {
    console.error(`Ошибка при получении данных ${name}:`, err.message);
    return null;
  }
}

// ============================
// 🤖 Команды Telegram
// ============================

// /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Привет! Доступные команды:\n\n" +
      "• /check — список игроков с сайта\n" +
      "• /duel <ник1> <ник2> — сравнить статистику игроков с ddnet.org"
  );
});

// /check
bot.onText(/\/check/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "⏳ Проверяю сайт...");

  const names = await getPlayerNames();

  if (!names) return bot.sendMessage(chatId, "⚠️ Не удалось получить список игроков.");
  if (names.length === 0) return bot.sendMessage(chatId, "😕 Игроков не найдено.");

  const text = names.map((n, i) => `${i + 1}. ${n}`).join("\n");
  bot.sendMessage(chatId, `🎮 Найдено ${names.length} ник(ов):\n\n${text}`);
});

// /duel <игрок1> <игрок2>
bot.onText(/\/duel (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].split(" ").filter(Boolean);

  if (args.length !== 2) {
    return bot.sendMessage(
      chatId,
      "⚔️ Использование: /duel <ник1> <ник2>\nПример: /duel test player123"
    );
  }

  const [p1, p2] = args;
  bot.sendMessage(chatId, `⏳ Сравниваю ${p1} и ${p2}...`);

  const [s1, s2] = await Promise.all([getPlayerStats(p1), getPlayerStats(p2)]);

  if (!s1 || !s2)
    return bot.sendMessage(chatId, "⚠️ Не удалось получить статистику одного из игроков.");

  let text = `⚔️ Duel: ${p1} vs ${p2}\n\n`;

  // Сравниваем только общие поля
  const keys = Object.keys(s1).filter((k) => s2[k]);

  if (keys.length === 0) {
    text += "❌ Не удалось найти общие параметры для сравнения.";
  } else {
    for (const key of keys) {
      text += `🏷️ ${key}\n${p1}: ${s1[key]}\n${p2}: ${s2[key]}\n\n`;
    }
  }

  bot.sendMessage(chatId, text);
});

console.log("✅ Бот запущен и ждёт команды в Telegram...");
