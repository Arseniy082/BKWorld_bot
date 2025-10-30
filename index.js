import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import cheerio from "cheerio";
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
// 📋 Получение списка игроков (онлайн)
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
// 📊 Статистика клана (teerank.io)
// ============================
async function getClanStatistics() {
  try {
    const { data } = await axios.get("https://teerank.io/clan/BKW");
    const $ = cheerio.load(data);
    const info = {};

    $("table tr").each((_, el) => {
      const key = $(el).find("th").text().trim();
      const val = $(el).find("td").text().trim();
      if (key && val) info[key] = val;
    });

    let result = "📊 *Статистика клана BKW:*\n\n";
    for (const [key, value] of Object.entries(info)) {
      result += `🏷️ ${key}: ${value}\n`;
    }

    return result || "⚠️ Не удалось получить статистику клана.";
  } catch (err) {
    console.error("Ошибка при получении статистики клана:", err.message);
    return "⚠️ Не удалось получить статистику клана.";
  }
}

// ============================
// 🖥️ Список серверов (status.tw)
// ============================
async function getServerList() {
  try {
    const { data } = await axios.get("https://status.tw/server/list");
    const $ = cheerio.load(data);

    const servers = [];
    $(".server-entry").each((_, el) => {
      const name = $(el).find(".server-name").text().trim();
      const map = $(el).find(".server-map").text().trim();
      const players = $(el).find(".server-players").text().trim();
      const country = $(el).find(".server-flag").attr("title") || "N/A";

      servers.push({ name, map, players, country });
    });

    if (servers.length === 0) return "⚠️ Не удалось найти сервера.";

    let message = "🖥️ *Список серверов:*\n\n";
    for (const s of servers.slice(0, 20)) {
      message += `🎮 ${s.name}\n🗺️ Карта: ${s.map}\n👥 Игроки: ${s.players}\n🌍 Страна: ${s.country}\n\n`;
    }

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
