import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import * as cheerio from "cheerio"; // Исправленный импорт
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const clanUrl = process.env.CLAN_URL;

if (!token || !clanUrl) {
  console.error("❌ Не указан TELEGRAM_BOT_TOKEN или CLAN_URL в .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================
// 🎮 Онлайн игроки
// ============================
async function getOnlinePlayers() {
  try {
    const { data } = await axios.get(clanUrl);
    const $ = cheerio.load(data);
    const names = [];

    $("a[href^='/player/']").each((_, el) => {
      const name = $(el).text().trim();
      if (name && !/player list/i.test(name)) names.push(name);
    });

    return names;
  } catch (err) {
    console.error("Ошибка при получении онлайн игроков:", err.message);
    return null;
  }
}

// ============================
// ⚔️ Сравнение статистики игроков
// ============================
async function getPlayerStats(name) {
  try {
    const url = `https://ddnet.org/players/${encodeURIComponent(name)}/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const stats = {};

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
// 📊 Статистика клана (через API teerank)
// ============================
async function getClanStatistics() {
  try {
    const { data } = await axios.get("https://api.teerank.io/clan/BKW");
    if (!data || !data.stats) return "⚠️ Не удалось получить статистику клана.";

    const stats = data.stats;
    return (
      `📊 *Статистика клана BKW:*\n\n` +
      `🏆 Ранг: ${stats.rank}\n` +
      `👥 Участников: ${stats.members}\n` +
      `🌍 Страна: ${stats.country}\n` +
      `🕹️ Очки: ${stats.points}\n` +
      `📈 Топ-карта: ${stats.top_map || "неизвестно"}`
    );
  } catch (err) {
    console.error("Ошибка при получении статистики клана:", err.message);
    return "⚠️ Не удалось получить статистику клана.";
  }
}

// ============================
// 🖥️ Список серверов (через API status.tw)
// ============================
async function getServerList() {
  try {
    const { data } = await axios.get("https://status.tw/api/server/list");
    if (!Array.isArray(data) || data.length === 0)
      return "⚠️ Не удалось получить список серверов.";

    let message = "🖥️ *Список серверов:*\n\n";
    data.slice(0, 15).forEach((s) => {
      message += `🎮 ${s.name}\n🗺️ Карта: ${s.map}\n👥 Игроки: ${s.clients}/${s.maxclients}\n🌍 Страна: ${s.country || "N/A"}\n\n`;
    });

    return message;
  } catch (err) {
    console.error("Ошибка при получении серверов:", err.message);
    return "⚠️ Не удалось получить список серверов.";
  }
}

// ============================
// 🤖 Команды Telegram
// ============================
bot.onText(/\/start/, (msg) => {
  const options = {
    reply_markup: {
      keyboard: [
        ["🎮 Онлайн", "⚔️ Сравнить игроков"],
        ["📊 Статистика клана", "🖥️ Сервера"],
        ["🎨 Стикеры", "🏷️ Приписка", "📢 TGK"],
        ["🧰 Скинпак"],
      ],
      resize_keyboard: true,
    },
  };

  bot.sendMessage(
    msg.chat.id,
    "👋 Привет! Это официальный бот клана *BKWORLD*.\n\n" +
      "Выбери действие с кнопок ниже 👇",
    { parse_mode: "Markdown", ...options }
  );
});

// ============================
// 🎮 Онлайн
// ============================
bot.onText(/\/online|🎮 Онлайн/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "⏳ Проверяю, кто онлайн...");

  const names = await getOnlinePlayers();
  if (!names) return bot.sendMessage(chatId, "⚠️ Не удалось получить список игроков.");
  if (names.length === 0) return bot.sendMessage(chatId, "😕 Никто не найден онлайн.");

  const text = names.map((n, i) => `${i + 1}. ${n}`).join("\n");
  bot.sendMessage(chatId, `🎮 Сейчас онлайн ${names.length} игрок(ов):\n\n${text}`);
});

// ============================
// ⚔️ Сравнение игроков
// ============================
bot.onText(/\/compare (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].split(" ").filter(Boolean);

  if (args.length !== 2)
    return bot.sendMessage(chatId, "⚔️ Использование: /compare <ник1> <ник2>");

  const [p1, p2] = args;
  bot.sendMessage(chatId, `⏳ Сравниваю ${p1} и ${p2}...`);

  const [s1, s2] = await Promise.all([getPlayerStats(p1), getPlayerStats(p2)]);
  if (!s1 || !s2)
    return bot.sendMessage(chatId, "⚠️ Не удалось получить статистику одного из игроков.");

  let text = `⚔️ *Сравнение:* ${p1} vs ${p2}\n\n`;
  const keys = Object.keys(s1).filter((k) => s2[k]);
  if (keys.length === 0) text += "❌ Общие параметры не найдены.";
  else {
    for (const key of keys) {
      text += `🏷️ ${key}\n${p1}: ${s1[key]}\n${p2}: ${s2[key]}\n\n`;
    }
  }
  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

bot.onText(/⚔️ Сравнить игроков/, (msg) =>
  bot.sendMessage(
    msg.chat.id,
    "✍️ Введи команду в формате:\n`/compare Ник1 Ник2`",
    { parse_mode: "Markdown" }
  )
);

// ============================
// Простые команды
// ============================
bot.onText(/\/tgk|📢 TGK/, (msg) =>
  bot.sendMessage(msg.chat.id, "📢 Наш Telegram-канал: @BKWORLDCHANNEL")
);
bot.onText(/\/clantag|🏷️ Приписка/, (msg) =>
  bot.sendMessage(msg.chat.id, "🏷️ Приписка клана: BKW")
);
bot.onText(/\/stickers|🎨 Стикеры/, (msg) =>
  bot.sendMessage(msg.chat.id, "🎨 Стикеры: https://t.me/addstickers/BKWORLDSTIK")
);

// ============================
// 📊 Статистика
// ============================
bot.onText(/\/statistics|📊 Статистика клана/, async (msg) => {
  bot.sendMessage(msg.chat.id, "📊 Загружаю статистику клана...");
  const result = await getClanStatistics();
  bot.sendMessage(msg.chat.id, result, { parse_mode: "Markdown" });
});

// ============================
// 🖥️ Серверы
// ============================
bot.onText(/\/serverlist|🖥️ Сервера/, async (msg) => {
  bot.sendMessage(msg.chat.id, "🖥️ Загружаю список серверов...");
  const result = await getServerList();
  bot.sendMessage(msg.chat.id, result, { parse_mode: "Markdown" });
});

// ============================
// 🧰 Скинпак
// ============================
bot.onText(/\/skinpack|🧰 Скинпак/, async (msg) => {
  const chatId = msg.chat.id;

  const instruction = `🧰 *Skin Pack by BKWORLD*  

📦 *Установка:*
Распаковать скин пак нужно в папку:

🪟 *Windows*  
\`C:\\Users\\Имя_пользователя\\AppData\\Roaming\\DDNet\\skins\`

📱 *Android*  
\`Телефон/Android/data/org.ddnet.client/files/user/skins\`
`;

  const photoPath = path.join(__dirname, "photo_2025-10-30_11-37-29.jpg");
  const zipPath = path.join(__dirname, "Skin pack by BKWORLD.zip");

  if (!fs.existsSync(photoPath) || !fs.existsSync(zipPath)) {
    return bot.sendMessage(chatId, "⚠️ Файлы скинпака не найдены на сервере.");
  }

  await bot.sendPhoto(chatId, photoPath, {
    caption: instruction,
    parse_mode: "Markdown",
  });

  await bot.sendDocument(chatId, zipPath, {
    caption: "📁 Скин пак для DDNet от клана BKWORLD",
  });
});

console.log("✅ Бот запущен и ждёт команды...");
