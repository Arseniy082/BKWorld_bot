import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("✅ Бот BKWORLD запущен!");

// === /start ===
bot.onText(/\/start/, (msg) => {
  const opts = {
    reply_markup: {
      keyboard: [
        ["🎮 Онлайн", "⚔️ Сравнить игроков"],
        ["📊 Статистика клана", "🖥️ Сервера"],
        ["📢 TGK", "🏷️ Приписка", "🎨 Стикеры"],
        ["🧰 Скинпак"]
      ],
      resize_keyboard: true,
    },
  };

  bot.sendMessage(
    msg.chat.id,
    "👋 Привет! Это бот клана *BKWORLD*.\nВыбери команду ниже 👇",
    { parse_mode: "Markdown", ...opts }
  );
});

// === /online ===
bot.onText(/\/online|🎮 Онлайн/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "⏳ Проверяю сайт...");

  try {
    const { data } = await axios.get("https://status.tw/clan/BKW");
    const $ = cheerio.load(data);
    const players = [];

    $("a[href^='/player/']").each((_, el) => {
      const name = $(el).text().trim();
      if (name && !/player list/i.test(name)) players.push(name);
    });

    if (players.length === 0)
      return bot.sendMessage(chatId, "⚠️ На сайте нет игроков онлайн.");

    await bot.sendMessage(
      chatId,
      `🎮 Найдено ${players.length} ник(ов):\n\n${players.join("\n")}`
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "⚠️ Не удалось получить список игроков.");
  }
});

// === /compare ===
bot.onText(/\/compare (.+) (.+)|⚔️ Сравнить игроков/, async (msg, match) => {
  const chatId = msg.chat.id;
  const player1 = match?.[1];
  const player2 = match?.[2];

  if (!player1 || !player2)
    return bot.sendMessage(chatId, "⚔️ Использование: /compare <ник1> <ник2>");

  await bot.sendMessage(chatId, `⚔️ Сравниваю ${player1} и ${player2}...`);

  try {
    const p1 = await getPlayerStats(player1);
    const p2 = await getPlayerStats(player2);

    if (!p1 || !p2)
      return bot.sendMessage(
        chatId,
        "⚠️ Не удалось получить статистику одного из игроков."
      );

    const result =
      `📊 Сравнение игроков:\n\n` +
      `👤 ${player1} — Очки: ${p1.points}, Ранг: ${p1.rank}\n` +
      `👤 ${player2} — Очки: ${p2.points}, Ранг: ${p2.rank}\n\n` +
      (p1.points > p2.points
        ? `🏆 ${player1} сильнее!`
        : p2.points > p1.points
        ? `🏆 ${player2} сильнее!`
        : "🤝 Равны по очкам!");

    bot.sendMessage(chatId, result);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "⚠️ Ошибка при сравнении игроков.");
  }
});

// === /statistics ===
bot.onText(/\/statistics|📊 Статистика клана/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "📊 Загружаю статистику клана...");

  try {
    const { data } = await axios.get("https://api.teerank.io/clan/BKW");

    if (!data || !data.stats)
      return bot.sendMessage(chatId, "⚠️ Не удалось получить данные клана.");

    const stats = data.stats;
    const message =
      `📊 *Статистика клана BKW:*\n\n` +
      `🏆 Ранг: ${stats.rank}\n` +
      `👥 Участников: ${stats.members}\n` +
      `🕹️ Очки: ${stats.points}\n` +
      `📈 Средний рейтинг: ${stats.average_rank}`;

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "⚠️ Не удалось загрузить статистику клана.");
  }
});

// === /serverlist ===
bot.onText(/\/serverlist|🖥️ Сервера/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "🖥️ Загружаю список серверов...");

  try {
    const { data } = await axios.get("https://status.tw/api/server/list");

    if (!Array.isArray(data) || data.length === 0)
      return bot.sendMessage(chatId, "⚠️ Не удалось найти сервера.");

    let message = "🖥️ *Список серверов:*\n\n";
    data.slice(0, 10).forEach((s) => {
      message += `🎮 ${s.name}\n🗺️ ${s.map}\n👥 ${s.clients}/${s.maxclients}\n🌍 ${s.country}\n\n`;
    });

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "⚠️ Не удалось получить список серверов.");
  }
});

// === /tgk ===
bot.onText(/\/tgk|📢 TGK/, (msg) =>
  bot.sendMessage(msg.chat.id, "📢 Наш Telegram канал: @BKWORLDCHANNEL")
);

// === /clantag ===
bot.onText(/\/clantag|🏷️ Приписка/, (msg) =>
  bot.sendMessage(msg.chat.id, "🏷️ Приписка клана: BKW")
);

// === /stickers ===
bot.onText(/\/stickers|🎨 Стикеры/, (msg) =>
  bot.sendMessage(msg.chat.id, "🎨 Стикеры клана: https://t.me/addstickers/BKWORLDSTIK")
);

// === /skinpack ===
bot.onText(/\/skinpack|🧰 Скинпак/, async (msg) => {
  const chatId = msg.chat.id;
  const photoPath = path.join(__dirname, "photo_2025-10-30_11-37-29.jpg");
  const filePath = path.join(__dirname, "Skin pack by BKWORLD.zip");

  const caption =
    "🧥 *Skin Pack by BKWORLD*\n\n" +
    "📦 Распаковать скин пак нужно в папку:\n\n" +
    "*Windows:*\nC:\\Users\\Имя_пользователя\\AppData\\Roaming\\DDNet\\skins\n\n" +
    "*Android:*\nТелефон/Android/data/org.ddnet.client/files/user/skins";

  if (!fs.existsSync(photoPath) || !fs.existsSync(filePath))
    return bot.sendMessage(chatId, "⚠️ Файлы скинпака не найдены.");

  await bot.sendPhoto(chatId, photoPath, { caption, parse_mode: "Markdown" });
  await bot.sendDocument(chatId, filePath);
});

// === Функция статистики игрока ===
async function getPlayerStats(name) {
  try {
    const { data } = await axios.get(`https://ddnet.org/players/${name}/`);
    const $ = cheerio.load(data);

    const points = $('td:contains("Points")').next().text().trim() || "0";
    const rank = $('td:contains("Rank")').next().text().trim() || "N/A";

    return { points: parseInt(points) || 0, rank };
  } catch {
    return null;
  }
}
