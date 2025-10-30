import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const url = process.env.CLAN_URL;

if (!token || !url) {
  console.error("❌ Не указан TELEGRAM_BOT_TOKEN или CLAN_URL в .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Функция для получения списка ников
async function getPlayerNames() {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.1 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const $ = cheerio.load(data);

    // Находим все ссылки на игроков
    const names = [];
    $("a[href^='/player/']").each((i, el) => {
      const name = $(el).text().trim();
      if (name && !/player list/i.test(name)) {
        names.push(name);
      }
    });

    return names;
  } catch (err) {
    console.error("Ошибка при запросе:", err.message);
    return null;
  }
}

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "👋 Привет! Отправь /check чтобы проверить игроков.");
});

// Обработка команды /check
bot.onText(/\/check/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "⏳ Проверяю сайт...");

  const names = await getPlayerNames();

  if (!names) {
    await bot.sendMessage(
      chatId,
      "⚠️ Не удалось получить список игроков (возможно, сайт недоступен)."
    );
    return;
  }

  if (names.length === 0) {
    await bot.sendMessage(chatId, "😕 Игроков не найдено.");
  } else {
    const text = names.map((n, i) => `${i + 1}. ${n}`).join("\n");
    await bot.sendMessage(chatId, `🎮 Найдено ${names.length} ник(ов):\n\n${text}`);
  }
});

console.log("✅ Бот запущен и ждёт команд в Telegram...");
