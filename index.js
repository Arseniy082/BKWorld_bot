// ===== BKW Telegram Bot =====
// Версия: 3.0 (с /menu, /compare и /predicookie)
// Автор: Nef0r / BKWORLD

import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Telegraf } from 'telegraf';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CLAN_URL = process.env.CLAN_URL || 'https://teerank.io/clan/BKW';
const bot = new Telegraf(BOT_TOKEN);

// ===== Для корректной работы путей =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== Функция: извлечение ников с сайта =====
async function fetchNicknames(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BKWBot/1.0)' },
    });

    const $ = cheerio.load(data);
    const nicknames = [];

    $('a[href*="/player/"]').each((_, el) => {
      const nick = $(el).text().trim();
      if (
        nick &&
        nick.length > 1 &&
        !nick.toLowerCase().includes('player') &&
        !nick.toLowerCase().includes('list') &&
        !/[^a-zA-Zа-яА-Я0-9_\\-]/.test(nick)
      ) {
        nicknames.push(nick);
      }
    });

    const unique = Array.from(new Set(nicknames));
    return unique.filter((n) => !/player/i.test(n) && !/list/i.test(n));
  } catch (err) {
    console.error('Ошибка при загрузке:', err.message);
    return [];
  }
}

// ===== Команды Telegram =====

// /start и /menu
const startMessage = `👋 Привет!  
Я бот клана **BKW** по игре **DDNet**.

📜 Доступные команды:
/tgk — канал клана  
/clantag — приписка клана  
/statistics — статистика клана  
/serverlist — список серверов  
/stickers — стикерпак  
/online — кто сейчас в онлайне  
/skinpack — скачать скинпак  
/compare — инструкция по сравнению игроков  
/predicookie — печенье с предсказанием 🍪  
/luck — аналог /predicookie`;

bot.start((ctx) => ctx.reply(startMessage));
bot.command('menu', (ctx) => ctx.reply(startMessage));

// /tgk
bot.command('tgk', (ctx) => ctx.reply('@BKWORLDCHANNEL'));

// /clantag
bot.command('clantag', (ctx) => ctx.reply('Приписка нашего клана — BKW'));

// /statistics
bot.command('statistics', (ctx) =>
  ctx.reply('📊 Статистика клана: https://teerank.io/clan/BKW')
);

// /serverlist
bot.command('serverlist', (ctx) =>
  ctx.reply('🖥 Список серверов: https://status.tw/server/list')
);

// /stickers
bot.command('stickers', (ctx) =>
  ctx.reply('🎨 Стикеры: https://t.me/addstickers/BKWORLDSTIK')
);

// /online (или /check)
bot.command(['online', 'check'], async (ctx) => {
  await ctx.reply('⏳ Проверяю сайт...');
  const nicknames = await fetchNicknames(CLAN_URL);

  if (nicknames.length === 0) {
    await ctx.reply('⚠️ Не удалось получить список игроков (возможно, сайт недоступен).');
  } else {
    const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    await ctx.reply(
      `🎮 Найдено ${nicknames.length} ник(ов):\n\n${nicknames.join('\n')}\n\n🕒 Проверено: ${time}`
    );
  }
});

// /skinpack — отправка инструкции и архива
bot.command('skinpack', async (ctx) => {
  try {
    const imagePath = join(__dirname, 'photo_2025-10-30_11-37-29.jpg');
    const zipPath = join(__dirname, 'Skin pack by BKWORLD.zip');

    if (!fs.existsSync(imagePath) || !fs.existsSync(zipPath)) {
      return ctx.reply('⚠️ Файлы скинпака не найдены на сервере.');
    }

    // 1️⃣ Инструкция
    await ctx.reply(
      `🧭 **Как установить скинпак BKW:**\n\n` +
      `**Windows:**\n📂 \`C:\\Users\\Имя_пользователя\\AppData\\Roaming\\DDNet\\skins\`\n\n` +
      `**Android:**\n📂 \`Телефон/Android/data/org.ddnet.client/files/user/skins\`\n\n` +
      `После распаковки перезапусти игру — скины появятся в списке.`
    );

    // 2️⃣ ZIP-файл
    await ctx.replyWithDocument({ source: zipPath, filename: 'Skin pack by BKWORLD.zip' });
  } catch (err) {
    console.error('Ошибка при отправке скинпака:', err);
    ctx.reply('❌ Произошла ошибка при отправке скинпака.');
  }
});

// /compare — инструкция по сравнению игроков
bot.command('compare', (ctx) =>
  ctx.reply(
    `⚖️ **Как сравнить игроков в DDNet:**\n\n` +
    `1️⃣ Перейди на сайт: https://ddnet.org/players/test/\n` +
    `2️⃣ В поле **"Player search"** введи свой ник и нажми **Enter**.\n` +
    `3️⃣ В поле **"Compare"** введи ник другого игрока.\n` +
    `4️⃣ Нажми **Enter**, чтобы сравнить результаты.\n\n` +
    `🧩 Вот так можно сравнивать игроков по статистике и времени.`
  )
);

// /predicookie и /luck — предсказания
bot.command(['predicookie', 'luck'], (ctx) => {
  const predictions = [
    "🍪 Сегодня ты поставишь новый рекорд... если не упадёшь на старте.",
    "🍪 Dummy сегодня умнее тебя — будь осторожен.",
    "🍪 На следующей карте ты проживёшь дольше 10 секунд. Возможно.",
    "🍪 Кто-то из твоей команды забыл включить brain.exe.",
    "🍪 Смотри под ноги. Особенно на карте с хуками.",
    "🍪 Сегодня твой прыжок будет точным, как никогда.",
    "🍪 Тебя ждёт великая слава... и один случайный фейл.",
    "🍪 Если карта называется ‘Brutal’, лучше не геройствуй.",
    "🍪 Ты найдёшь новый способ упасть с респауна.",
    "🍪 Сегодня Dummy поведёт тебя к победе. Или в пропасть.",
    "🍪 Не доверяй никому, кто говорит: ‘Это просто карта’.",
    "🍪 Если у тебя лаги — значит, судьба хочет, чтобы ты отдохнул.",
    "🍪 Каждый прыжок приближает тебя к бессмертному WR.",
    "🍪 Сегодня ты пройдёшь карту с первой попытки... во сне.",
    "🍪 Не все герои носят плащи. Некоторые просто жмут R.",
    "🍪 Если тебя тянут не туда — возможно, это твой Dummy.",
    "🍪 Сегодняшний день принесёт тебе +1 к скиллу и -2 к терпению.",
    "🍪 Кто падал — тот поднимется. Кто фейлил — тот поставит рекорд.",
    "🍪 Сегодня ты поймёшь, зачем на карте чекпоинты.",
    "🍪 Удача на твоей стороне. Но DDNet — нет.",
    "🍪 Хукай с умом. Особенно Dummy.",
    "🍪 Сегодня твоя команда вспомнит, что кнопка 'jump' существует.",
    "🍪 Если не получилось с первой попытки — попробуй 154-й раз.",
    "🍪 Когда кажется, что всё потеряно — посмотри под карту.",
    "🍪 Ты поставишь рекорд, если не начнёшь объяснять, как пройти.",
    "🍪 Dummy ждёт тебя. Он верит, что ты не снова его уронишь.",
    "🍪 Сегодня твой худший прыжок станет твоим лучшим падением.",
    "🍪 Иногда, чтобы выиграть, надо просто не упасть.",
    "🍪 Даже сервер DDNet знает, что ты заслужил рекорд.",
    "🍪 Проверь, не забыл ли ты shift. Он тебе сегодня понадобится.",
    "🍪 Настоящие тимплееры не бросают Dummy. Даже если тот лагает.",
    "🍪 Один день без DDNet — минус один шанс на рекорд.",
    "🍪 Сегодня ты узнаешь, что чекпоинт был не там, где ты думал.",
    "🍪 Твоя мышка знает все твои фейлы. И всё ещё с тобой.",
    "🍪 Иногда победа — это просто не rage quit.",
    "🍪 Даже если всё плохо — хоть Dummy на месте.",
    "🍪 Сегодня ты поставишь рекорд… если не откроешь Discord.",
    "🍪 Настоящая боль — упасть за миллиметр до финиша.",
    "🍪 Удача любит тех, кто не спешит. Или хотя бы не падает.",
    "🍪 Сегодня ты узнаешь, что кнопка R — не всегда выход."
  ];

  const randomPrediction = predictions[Math.floor(Math.random() * predictions.length)];
  ctx.reply(randomPrediction);
});

// ===== Запуск бота =====
bot.launch();
console.log('✅ Бот запущен и готов к работе.');

// ===== Корректная остановка =====
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ===== Минимальный веб-сервер для Render =====
import express from "express";
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ BKW Bot is running and alive!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});
